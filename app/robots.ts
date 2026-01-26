export default function robots() {
    const base = "https://soltani.org";
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: `${base}/sitemap.xml`,
    };
  }
  