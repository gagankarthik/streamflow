
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

interface WhitespaceSafeTableProps {
  headers: string[];
  data: (string | ReactNode)[][];
  caption?: string;
  tableClassName?: string;
  theadClassName?: string;
  tbodyClassName?: string;
  trClassName?: string; // Applied to all <TableRow> elements
  thClassName?: string;
  tdClassName?: string;
  captionClassName?: string;
}

export function WhitespaceSafeTable({
  headers,
  data,
  caption,
  tableClassName,
  theadClassName,
  tbodyClassName,
  trClassName,
  thClassName,
  tdClassName,
  captionClassName,
}: WhitespaceSafeTableProps) {
  return (
    <Table className={cn(tableClassName)}>
      {caption && <TableCaption className={cn(captionClassName)}>{caption}</TableCaption>}
      <TableHeader className={cn(theadClassName)}>
        <TableRow className={cn(trClassName)}>
          {headers.map((header, index) => (
            <TableHead key={`header-${index}`} className={cn(thClassName)}>
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className={cn(tbodyClassName)}>
        {data.map((row, rowIndex) => (
          <TableRow key={`row-${rowIndex}`} className={cn(trClassName)}>
            {row.map((cellContent, cellIndex) => (
              <TableCell key={`cell-${rowIndex}-${cellIndex}`} className={cn(tdClassName)}>
                {cellContent}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
              No data available.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default WhitespaceSafeTable;
