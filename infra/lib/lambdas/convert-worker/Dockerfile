# Stage 1: bundle TypeScript -> single JS file
FROM node:20-slim AS builder
WORKDIR /app
COPY index.ts package*.json ./
RUN npm install -g esbuild
RUN esbuild index.ts \
    --bundle --platform=node --target=node20 \
    --external:"@aws-sdk/*" \
    --external:sharp \
    --external:heic-convert \
    --outfile=dist/index.js

# Stage 2: production node dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: python packages (Debian/glibc compatible with final stage)
FROM python:3.11-slim AS python-deps
RUN pip install --no-cache-dir --target /python-packages \
    "PyMuPDF>=1.23.0" \
    "Pillow>=10.0.0"

# Stage 4: custom Lambda runtime image (Debian + aws-lambda-ric)
FROM node:20-slim
WORKDIR /var/task

ENV DEBIAN_FRONTEND=noninteractive

# High-fidelity DOCX rendering stack:
# - LibreOffice writer/headless conversion
# - font packages for Word-compatible substitution
# - build tools only for aws-lambda-ric native install (removed afterwards)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libreoffice-writer \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation2 \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-noto-core \
    fonts-noto-cjk \
    cmake \
    g++ \
    make \
    autoconf \
    automake \
    libtool \
    && npm install -g aws-lambda-ric \
    && apt-get purge -y --auto-remove \
      cmake \
      g++ \
      make \
      autoconf \
      automake \
      libtool \
      python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist/index.js ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=python-deps /python-packages /var/task/python-packages

ENV PYTHONPATH=/var/task/python-packages

COPY fonts/local.conf /etc/fonts/local.conf
RUN fc-cache -f

# Converter scripts called from Node via subprocess.
COPY docx_sanitize.py /var/task/docx_sanitize.py
COPY docx_to_pdf.py /var/task/docx_to_pdf.py
COPY pages_to_pdf.py /var/task/pages_to_pdf.py
COPY document_to_images_zip.py /var/task/document_to_images_zip.py
COPY image_to_pdf.py /var/task/image_to_pdf.py
COPY image_special_convert.py /var/task/image_special_convert.py

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["index.handler"]
