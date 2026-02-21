import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cbae — Personal AI",
  description: "Your autonomous AI assistant",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
