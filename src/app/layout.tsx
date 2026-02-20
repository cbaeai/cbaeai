import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cbae — Personal AI",
  description: "Your autonomous AI assistant",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
