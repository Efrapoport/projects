import { generateDocs } from "@/lib/doc-generator";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Simple markdown-to-JSX renderer for our controlled markdown format
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let key = 0;

  function flushTable() {
    if (tableRows.length === 0) return;
    elements.push(
      <div key={key++} className="overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              {tableRows[0].map((cell, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(2).map((row, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-gray-600 border-b border-gray-100"
                    dangerouslySetInnerHTML={{
                      __html: cell
                        .replace(
                          /\*\*(.+?)\*\*/g,
                          '<strong class="text-gray-900">$1</strong>'
                        )
                        .replace(
                          /`(.+?)`/g,
                          '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>'
                        ),
                    }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  }

  for (const line of lines) {
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto my-4 font-mono"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Tables
    if (line.startsWith("|")) {
      inTable = true;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="text-3xl font-bold text-gray-900 mt-8 mb-4">
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={key++}
          className="text-2xl font-bold text-gray-800 mt-8 mb-3 pb-2 border-b border-gray-200"
        >
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-lg font-semibold text-gray-700 mt-6 mb-2">
          {line.slice(4)}
        </h3>
      );
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key++}
          className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 my-3 text-sm text-blue-800 italic"
        >
          {line.slice(2)}
        </blockquote>
      );
      continue;
    }

    // Horizontal rules
    if (line === "---") {
      elements.push(<hr key={key++} className="my-6 border-gray-200" />);
      continue;
    }

    // List items
    if (line.startsWith("- ")) {
      elements.push(
        <li
          key={key++}
          className="ml-4 text-sm text-gray-600 list-disc my-1"
          dangerouslySetInnerHTML={{
            __html: line
              .slice(2)
              .replace(
                /\*\*(.+?)\*\*/g,
                '<strong class="text-gray-900">$1</strong>'
              )
              .replace(
                /`(.+?)`/g,
                '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>'
              ),
          }}
        />
      );
      continue;
    }

    // Numbered list items
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <li
          key={key++}
          className="ml-4 text-sm text-gray-600 list-decimal my-1"
          dangerouslySetInnerHTML={{
            __html: numberedMatch[2]
              .replace(
                /\*\*(.+?)\*\*/g,
                '<strong class="text-gray-900">$1</strong>'
              )
              .replace(
                /`(.+?)`/g,
                '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>'
              ),
          }}
        />
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p
        key={key++}
        className="text-sm text-gray-600 my-2 leading-relaxed"
        dangerouslySetInnerHTML={{
          __html: line
            .replace(
              /\*\*(.+?)\*\*/g,
              '<strong class="text-gray-900">$1</strong>'
            )
            .replace(
              /`(.+?)`/g,
              '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>'
            ),
        }}
      />
    );
  }

  if (inTable) flushTable();

  return elements;
}

export default function DocsPage() {
  const docs = generateDocs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">System Documentation</h1>
            <p className="text-xs text-gray-500">
              Auto-generated {new Date(docs.generatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/api/logs"
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              View Logs
            </Link>
            <Link
              href="/api/docs/generate"
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Raw JSON
            </Link>
          </div>
        </div>
      </header>

      {/* Table of Contents */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <nav className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Contents
          </h2>
          <div className="flex flex-wrap gap-2">
            {docs.sections.map((section, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md"
              >
                {i + 1}. {section.title}
              </span>
            ))}
          </div>
        </nav>

        {/* Documentation Content */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          {docs.sections.map((section, i) => (
            <div key={i} className="mb-8">
              {renderMarkdown(section.content)}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 mb-8">
          <p className="text-xs text-gray-400">
            Documentation is auto-generated from source code on every page load.
            Changes to the codebase are automatically reflected here.
          </p>
        </div>
      </div>
    </div>
  );
}
