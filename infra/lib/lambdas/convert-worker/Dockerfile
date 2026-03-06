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
# so compiled extensions (PyMuPDF) are binary-compatible.
# amazonlinux:2023 has full SSL support unlike the stripped Lambda base image.
FROM --platform=linux/amd64 amazonlinux:2023 AS python-deps
# pango-devel/cairo-devel/gdk-pixbuf2-devel/libffi-devel needed to compile WeasyPrint/cffi
RUN dnf install -y \
    python3 python3-pip python3-devel gcc \
    pango-devel cairo-devel gdk-pixbuf2-devel libffi-devel \
    && dnf clean all
# PyMuPDF: PDF text extraction + page rendering (no OpenCV / libGL dependency).
# mammoth: DOCX→HTML for WeasyPrint; weasyprint: HTML→PDF for DOCX→PDF output.
RUN pip3 install --no-cache-dir --target /python-packages \
    "PyMuPDF>=1.23.0" \
    mammoth weasyprint

# Stage 4: Lambda container image
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task
COPY --from=builder /app/dist/index.js ./
COPY --from=deps /app/node_modules ./node_modules

# DejaVu Sans font required by @napi-rs/canvas for DOCX text rendering.
# Without a registered font, fillText() draws nothing and the output is blank.
RUN mkdir -p /var/task/fonts
COPY --from=deps /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /var/task/fonts/DejaVuSans.ttf

# Python 3 + WeasyPrint runtime dependencies (pango, cairo, gdk-pixbuf2 for rendering;
# google-noto-sans-fonts so fontconfig resolves sans-serif for PDF text layout).
# Note: tesseract is not in the Lambda AL2023 repo.
RUN dnf install -y \
    python3 \
    pango cairo gdk-pixbuf2 fontconfig \
    google-noto-sans-fonts \
    && dnf clean all

# Python packages built on amazonlinux:2023 (binary-compatible with Lambda image).
COPY --from=python-deps /python-packages /var/task/python-packages
ENV PYTHONPATH=/var/task/python-packages

# Converter scripts called from Node.js via subprocess.
COPY docx_to_pdf.py /var/task/docx_to_pdf.py
COPY pdf_page_to_png.py /var/task/pdf_page_to_png.py

CMD ["index.handler"]
