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

# Stage 3: Lambda container image
FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:20
WORKDIR /var/task
COPY --from=builder /app/dist/index.js ./
COPY --from=deps /app/node_modules ./node_modules

# DejaVu Sans font required by @napi-rs/canvas for DOCX text rendering.
# Without a registered font, fillText() draws nothing and the output is blank.
RUN mkdir -p /var/task/fonts
COPY --from=deps /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /var/task/fonts/DejaVuSans.ttf

# Python 3 + pdf2docx for PDF → DOCX layout-preserving conversion.
# pdf2docx handles text-based PDFs with full layout fidelity (tables, columns,
# images). For scanned PDFs (image-only pages) it embeds the rasters as images
# so the DOCX is still visually faithful without requiring OCR.
RUN dnf install -y python3 python3-pip && dnf clean all
RUN pip3 install --no-cache-dir pdf2docx

# Copy the converter script so the Node.js handler can call it via subprocess.
COPY pdf_to_docx.py /var/task/pdf_to_docx.py

CMD ["index.handler"]
