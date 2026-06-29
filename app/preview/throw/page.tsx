export const metadata = { title: "Trigger error — preview", robots: { index: false } };

// Render at request time only — otherwise Next prerenders this page at BUILD
// time, the throw below fires, and the entire production build fails.
export const dynamic = "force-dynamic";

// Throws during render so you can see the REAL app/error.tsx boundary catch it
// end-to-end (including the Try-again reset()).
export default function ThrowPreview() {
  throw new Error("Preview: intentional error to demo the error boundary.");
}
