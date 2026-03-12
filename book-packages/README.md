# Book Packages

Put JSON book packages in this folder for ingestion uploads.

Included sample:
- `atomic-habits.reference.json`

Upload this package with:

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://your-app-domain \
  --token "<COGNITO_ID_TOKEN>" \
  --file book-packages/atomic-habits.reference.json \
  --publish
```

See full guide:
- `docs/BOOKAPP_ADMIN_GUIDE.md`
