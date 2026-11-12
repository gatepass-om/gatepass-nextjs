"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const inner = React.useRef<HTMLTableElement | null>(null)
  React.useImperativeHandle(ref, () => inner.current as HTMLTableElement)

  // On phones the rows stack into labelled lines (see .stack-table in globals.css); each cell
  // carries its column heading so the stacked line can show it.
  React.useEffect(() => {
    const table = inner.current
    if (!table) return
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => {
        const text = (th.textContent ?? "").trim()
        // An actions column is just a menu button; it needs no label of its own.
        return /^(actions?|row actions|الإجراءات|إجراءات)$/i.test(text) ? "" : text
      })
      table.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          const next = heads[index] ?? ""
          if (cell.getAttribute("data-label") !== next) cell.setAttribute("data-label", next)
        })
      })
    }
    label()
    const observer = new MutationObserver(label)
    observer.observe(table, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
      <table
        ref={inner}
        className={cn("stack-table w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-start align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pe-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pe-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
