# Stage 1: bundle TypeScript → single JS file
FROM --platform=linux/amd64 node:20-slim AS builder
WORKDIR /app
COPY index.ts package*.json ./
RUN npm install -g esbuild
RUN esbuild index.ts \
    --bundle --platform=node --target=node20 \
    --external:"@aws-sdk/*" \
    --external:sharp \
    --external:"@napi-rs/canvas" \
    --external:mupdf \
    --external:mammoth \
    --external:heic-convert \
    --outfile=dist/index.js

# Stage 2: production dependencies (native binaries compiled for linux/amd64)
# Also installs DejaVu fonts so we can copy them into the Lambda image for
# @napi-rs/canvas DOCX text rendering (Lambda has no system fonts).
FROM --platform=linux/amd64 node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev

# Stage 3: Python package build — use amazonlinux:2023 (same OS/glibc as Lambda)
# so compiled extensions (PyMuPDF, opencv) are binary-compatible.
# amazonlinux:2023 has full SSL support unlike the stripped Lambda base image.
FROM --platform=linux/amd64 amazonlinux:2023 AS python-deps
RUN dnf install -y python3 python3-pip python3-devel gcc && dnf clean all
RUN pip3 install --no-cache-dir --target /python-packages pdf2docx

# Stage 4: Lambda container image
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task
COPY --from=builder /app/dist/index.js ./
COPY --from=deps /app/node_modules ./node_modules

# DejaVu Sans font required by @napi-rs/canvas for DOCX text rendering.
# Without a registered font, fillText() draws nothing and the output is blank.
RUN mkdir -p /var/task/fonts
COPY --from=deps /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /var/task/fonts/DejaVuSans.ttf

# Python 3 runtime (no pip needed — packages are pre-installed via --target).
RUN dnf install -y python3 && dnf clean all

# pdf2docx + dependencies built on amazonlinux:2023 (binary-compatible with Lambda).
COPY --from=python-deps /python-packages /var/task/python-packages
ENV PYTHONPATH=/var/task/python-packages

# Copy the converter script so the Node.js handler can call it via subprocess.
COPY pdf_to_docx.py /var/task/pdf_to_docx.py

CMD ["index.handler"]
