// fileParser.ts — client-side only
// Handles: images, PDFs, ZIPs, and all text/code file types
// Returns a unified Attachment object ready for the Message store

import type { Attachment } from "@/types"

// ── File type classification ───────────────────────────────────

// Extensions we treat as plain text / code (read directly)
const CODE_EXTENSIONS: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", cpp: "cpp", cs: "csharp", php: "php", swift: "swift",
  kt: "kotlin", r: "r", sh: "bash", bash: "bash", zsh: "bash",
  sql: "sql", html: "html", css: "css", scss: "css", sass: "css",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
  md: "markdown", mdx: "markdown", txt: "text", csv: "csv",
  env: "text", gitignore: "text", dockerfile: "dockerfile",
  graphql: "graphql", gql: "graphql",
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}

function detectLanguage(filename: string): string | undefined {
  return CODE_EXTENSIONS[getExtension(filename)]
}

export function classifyFile(file: File): "image" | "pdf" | "zip" | "code" | "unsupported" {
  if (file.type.startsWith("image/")) return "image"
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) return "pdf"
  if (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.endsWith(".zip")
  ) return "zip"
  if (detectLanguage(file.name)) return "code"
  return "unsupported"
}

// ── Size limits ────────────────────────────────────────────────
const LIMITS = {
  image:  10 * 1024 * 1024,  // 10 MB
  pdf:    20 * 1024 * 1024,  // 20 MB
  zip:    30 * 1024 * 1024,  // 30 MB
  code:    1 * 1024 * 1024,  //  1 MB
}

// ── Image processing (unchanged from before) ──────────────────
async function processImage(file: File): Promise<Attachment> {
  if (file.size > LIMITS.image) throw new Error("Image must be under 10 MB")
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string
      const base64 = previewUrl.split(",")[1]
      resolve({
        kind: "image",
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64,
        previewUrl,
      })
    }
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

// ── PDF processing — uses pdfjs-dist ─────────────────────────
// pdfjs-dist is a Mozilla library that runs in the browser.
// It renders PDF pages into a canvas or extracts raw text via getTextContent().
// We use the text path — no canvas needed, just strings.
async function processPDF(file: File): Promise<Attachment> {
  if (file.size > LIMITS.pdf) throw new Error("PDF must be under 20 MB")

  // Dynamic import so pdfjs only loads when needed (code splitting)
  const pdfjsLib = await import("pdfjs-dist")

  // Point the worker at the CDN copy so we don't need a local worker file.
  // This is the standard setup for Next.js / browser environments.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  // Read the file as an ArrayBuffer (raw bytes) — what pdfjs expects
  const arrayBuffer = await file.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  // Cap at 30 pages to keep the context window reasonable
  const pagesToRead = Math.min(totalPages, 30)
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    // Each item in textContent.items has a `str` property — join them
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (pageText) pageTexts.push(`--- Page ${pageNum} ---\n${pageText}`)
  }

  const extractedText = pageTexts.join("\n\n")
  const truncated = extractedText.length > 40000
    ? extractedText.slice(0, 40000) + "\n\n[...truncated at 40,000 chars]"
    : extractedText

  const summary = totalPages > pagesToRead
    ? `PDF: ${file.name} (${totalPages} pages, showing first ${pagesToRead})`
    : `PDF: ${file.name} (${totalPages} page${totalPages === 1 ? "" : "s"})`

  return {
    kind: "file",
    name: file.name,
    mimeType: "application/pdf",
    size: file.size,
    extractedText: `${summary}\n\n${truncated}`,
  }
}

// ── ZIP processing — uses JSZip ───────────────────────────────
// JSZip reads a ZIP archive and gives us access to each file inside.
// We read text files (code, docs) and skip binaries (images, executables).
async function processZIP(file: File): Promise<Attachment> {
  if (file.size > LIMITS.zip) throw new Error("ZIP must be under 30 MB")

  const JSZip = (await import("jszip")).default
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const TEXT_MIME_PREFIXES = ["text/"]
  const TEXT_EXTENSIONS = new Set([
    ...Object.keys(CODE_EXTENSIONS),
    "txt", "md", "csv", "json", "xml", "yaml", "yml", "toml", "env",
    "gitignore", "lock", "cfg", "ini", "conf",
  ])

  function isTextFile(filename: string): boolean {
    const ext = getExtension(filename)
    return TEXT_EXTENSIONS.has(ext)
  }

  // Collect all file entries (skip directories)
  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir)
  const totalFiles = entries.length

  const parts: string[] = [
    `ZIP: ${file.name} — ${totalFiles} file${totalFiles === 1 ? "" : "s"} total\n`,
    "Contents:\n" + entries.map(([name]) => `  • ${name}`).join("\n"),
    "",
  ]

  // Read up to 20 text files, cap each at 8000 chars
  let filesRead = 0
  let totalChars = 0
  const MAX_TOTAL_CHARS = 50000

  for (const [name, zipFile] of entries) {
    if (!isTextFile(name)) continue
    if (filesRead >= 20) { parts.push(`\n[...stopped after 20 files]`); break }
    if (totalChars >= MAX_TOTAL_CHARS) { parts.push(`\n[...character limit reached]`); break }

    try {
      const text = await zipFile.async("string")
      const lang = detectLanguage(name)
      const preview = text.length > 8000 ? text.slice(0, 8000) + "\n[...truncated]" : text
      parts.push(`\n${"─".repeat(50)}\nFile: ${name}\n${"─".repeat(50)}\n\`\`\`${lang || ""}\n${preview}\n\`\`\``)
      totalChars += preview.length
      filesRead++
    } catch {
      parts.push(`\n[Could not read ${name}]`)
    }
  }

  return {
    kind: "file",
    name: file.name,
    mimeType: "application/zip",
    size: file.size,
    fileCount: totalFiles,
    extractedText: parts.join("\n"),
  }
}

// ── Code / text file processing ───────────────────────────────
async function processCode(file: File): Promise<Attachment> {
  if (file.size > LIMITS.code) throw new Error("Code file must be under 1 MB")

  const text = await file.text()  // FileReader shorthand — reads as UTF-8
  const language = detectLanguage(file.name)

  const preview = text.length > 30000
    ? text.slice(0, 30000) + "\n[...truncated at 30,000 chars]"
    : text

  const extractedText = `File: ${file.name}\n\`\`\`${language || ""}\n${preview}\n\`\`\``

  return {
    kind: "file",
    name: file.name,
    mimeType: file.type || "text/plain",
    size: file.size,
    language,
    extractedText,
  }
}

// ── Main entry point ──────────────────────────────────────────
// Call this with any File. Returns a Promise<Attachment>.
// Throws with a human-readable error message on failure.
export async function processFile(file: File): Promise<Attachment> {
  const kind = classifyFile(file)

  switch (kind) {
    case "image":       return processImage(file)
    case "pdf":         return processPDF(file)
    case "zip":         return processZIP(file)
    case "code":        return processCode(file)
    case "unsupported":
      throw new Error(
        `"${file.name}" isn't supported yet. Supported: images, PDFs, ZIPs, and code files (${Object.keys(CODE_EXTENSIONS).slice(0, 8).join(", ")}…)`
      )
  }
}

// ── UI helpers — used by ChatInput ────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileIcon(attachment: Attachment): string {
  if (attachment.kind === "image") return "🖼️"
  const ext = getExtension(attachment.name)
  if (ext === "pdf") return "📄"
  if (ext === "zip") return "🗜️"
  if (["py"].includes(ext)) return "🐍"
  if (["js", "ts", "jsx", "tsx"].includes(ext)) return "⚡"
  if (["json", "yaml", "yml", "toml"].includes(ext)) return "⚙️"
  if (["md", "txt"].includes(ext)) return "📝"
  if (["html", "css", "scss"].includes(ext)) return "🎨"
  if (["sql"].includes(ext)) return "🗃️"
  if (["sh", "bash"].includes(ext)) return "💻"
  return "📁"
}
