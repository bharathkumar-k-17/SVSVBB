import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useGlobalLogo } from '../hooks/useGlobalLogo';

interface A4ExportSystemProps {
  data: any[];
  title: string;
  headers: string[];
  columns: string[];
  columnWidths?: string[];
  columnAligns?: ('left' | 'center' | 'right')[];
  footerData?: Record<string, string | number>;
  filename?: string;
  year: number;
}

/**
 * PRODUCTION-READY A4 FIXED PDF SYSTEM
 * Strictly paginated, centered background, sequential PDF assembly.
 */
export const A4ExportSystem: React.FC<A4ExportSystemProps> = ({
  data,
  title,
  headers,
  columns,
  columnWidths,
  columnAligns,
  footerData,
  filename = 'records.pdf',
  year
}) => {
  const logoSrc = useGlobalLogo();
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const CHUNK_SIZE = 30;
  const pages = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    pages.push(data.slice(i, i + CHUNK_SIZE));
  }

  // ── REUSABLE UNIFIED TABLE COMPONENT (STRICT DESIGN SYSTEM) ──
  const UnifiedPDFTable = ({ pageData, pageIndex, isLastPage }: { pageData: any[], pageIndex: number, isLastPage: boolean }) => {
    const isVolunteerReport = headers.length === 7 && title.includes('Volunteer');
    
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', color: '#000' }}>
        <thead>
          {isVolunteerReport ? (
            /* SPECIAL TWO-LEVEL HEADER FOR VOLUNTEER COLLECTIONS */
            <>
              <tr style={{ backgroundColor: '#fdfdfd' }}>
                <th rowSpan={2} style={{ width: '5%', padding: '3px 2px', textAlign: 'center', fontWeight: '900', border: '1px solid #ddd', borderTop: '2px solid #000' }}>S.NO</th>
                <th rowSpan={2} style={{ width: '15%', padding: '3px 2px', textAlign: 'left', fontWeight: '900', border: '1px solid #ddd', borderTop: '2px solid #000' }}>VOLUNTEER NAME</th>
                <th colSpan={2} style={{ width: '25%', padding: '3px 2px', textAlign: 'center', fontWeight: '900', border: '1px solid #ddd', backgroundColor: '#f9fafb', borderTop: '2px solid #000' }}>TODAY'S COLLECTION</th>
                <th colSpan={2} style={{ width: '27%', padding: '3px 2px', textAlign: 'center', fontWeight: '900', border: '1px solid #ddd', backgroundColor: '#f3f4f6', borderTop: '2px solid #000' }}>TOTAL COLLECTION</th>
                <th colSpan={2} style={{ width: '28%', padding: '3px 2px', textAlign: 'center', fontWeight: '900', border: '1px solid #ddd', backgroundColor: '#fee2e2', borderTop: '2px solid #000' }}>PENDING</th>
              </tr>
              <tr style={{ backgroundColor: '#fdfdfd' }}>
                <th style={{ padding: '3px 2px', textAlign: 'center', fontSize: '9px', border: '1px solid #ddd' }}>DEVOTEES</th>
                <th style={{ padding: '3px 2px', textAlign: 'right', fontSize: '9px', border: '1px solid #ddd' }}>AMOUNT</th>
                <th style={{ padding: '3px 2px', textAlign: 'center', fontSize: '9px', border: '1px solid #ddd' }}>DEVOTEES</th>
                <th style={{ padding: '3px 2px', textAlign: 'right', fontSize: '9px', border: '1px solid #ddd' }}>AMOUNT</th>
                <th style={{ padding: '3px 2px', textAlign: 'center', fontSize: '9px', border: '1px solid #ddd' }}>DEVOTEES</th>
                <th style={{ padding: '3px 2px', textAlign: 'right', fontSize: '9px', border: '1px solid #ddd' }}>AMOUNT</th>
              </tr>
            </>
          ) : (
            /* STANDARD ONE-LEVEL HEADER */
            <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#fdfdfd' }}>
              <th style={{ width: '5%', padding: '3px 2px', textAlign: 'center', fontWeight: '900', verticalAlign: 'top' }}>S.NO</th>
              {headers.map((h, i) => (
                <th key={i} style={{ width: columnWidths?.[i] || 'auto', padding: '3px 2px', textAlign: columnAligns?.[i] || 'left', fontWeight: '900', verticalAlign: 'top' }}>
                   {h.toUpperCase()}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {pageData.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ borderBottom: '0.5px solid #eee', height: '28px' }}>
              <td style={{ textAlign: 'center', fontWeight: '700', verticalAlign: 'top', border: isVolunteerReport ? '1px solid #eee' : 'none', padding: '3px 2px' }}>
                {pageIndex * CHUNK_SIZE + rowIndex + 1}
              </td>
              {isVolunteerReport ? (
                /* MULTI-CELL BODY FOR VOLUNTEERS */
                <>
                  <td style={{ width: '15%', fontWeight: '900', textAlign: 'left', verticalAlign: 'top', border: '1px solid #eee', padding: '3px 2px', textTransform: 'uppercase' }}>
                    {row[columns[0]]}
                  </td>
                  <td style={{ textAlign: 'center', border: '1px solid #eee' }}>{row[columns[1]]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #eee', color: '#16a34a', paddingRight: '4px' }}>{row[columns[2]]}</td>
                  <td style={{ textAlign: 'center', border: '1px solid #eee' }}>{row[columns[3]]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #eee', color: '#000', paddingRight: '4px' }}>{row[columns[4]]}</td>
                  <td style={{ textAlign: 'center', border: '1px solid #eee' }}>{row[columns[5]]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #eee', color: '#dc2626', paddingRight: '4px' }}>{row[columns[6]] || '₹0'}</td>
                </>
              ) : (
                /* FLEX BODY FOR OTHER REPORTS */
                <>
                  {columns.map((col, i) => (
                    <td key={col} style={{ padding: '3px 2px', textAlign: columnAligns?.[i] || 'left', fontWeight: i === 0 ? '900' : '700', verticalAlign: 'top', wordBreak: 'break-word', textTransform: 'uppercase' }}>
                      {row[col]}
                    </td>
                  ))}
                </>
              )}
            </tr>
          ))}
          {/* FILL EMPTY ROWS */}
          {pageData.length < CHUNK_SIZE && Array.from({ length: CHUNK_SIZE - pageData.length }).map((_, idx) => (
            <tr key={`fill-${idx}`} style={{ borderBottom: '0.5px solid #eee', height: '28px' }}>
              <td style={{ textAlign: 'center', fontWeight: '700', color: '#ccc', border: isVolunteerReport ? '1px solid #eee' : 'none', padding: '3px 2px' }}>
                  {pageIndex * CHUNK_SIZE + pageData.length + idx + 1}
              </td>
              <td colSpan={isVolunteerReport ? 7 : columns.length} style={{ border: isVolunteerReport ? '1px solid #eee' : 'none', padding: '3px 2px' }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
        
        {isLastPage && footerData && (
            <tfoot>
                <tr style={{ borderTop: '2.5px solid #000', backgroundColor: '#fff', fontWeight: '900' }}>
                    <td colSpan={columns.length + 1} style={{ padding: '8px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '20px' }}>
                            <span style={{ textTransform: 'uppercase', marginRight: '10px' }}>SUMMARY TOTALS:</span>
                            {Object.values(footerData).map((val, i) => (
                                <span key={i}>{val}</span>
                            ))}
                        </div>
                    </td>
                </tr>
            </tfoot>
        )}
      </table>
    );
  };



  // Handle PDF Export sequentially (Page by Page)
  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);

    try {
        const pdf = new jsPDF('p', 'px', [794, 1123]);
        const pageElements = containerRef.current.querySelectorAll('.pdf-page');

        for (let i = 0; i < pageElements.length; i++) {
            const page = pageElements[i] as HTMLElement;
            const canvas = await html2canvas(page, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 794, 1123, undefined, 'FAST');
        }

        pdf.save(`${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    } catch (error) {
        console.error('Export Error:', error);
        alert('Failed to generate PDF. Please try again.');
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold shadow-lg hover:bg-black transition-all transform hover:scale-105 active:scale-95 disabled:opacity-70"
      >
        {isExporting ? <Loader2 className="animate-spin h-5 w-5" /> : <Download size={20} />}
        {isExporting ? 'Generating PDF...' : 'Download PDF List'}
      </button>

      {/* ── HIDDEN PDF RENDERING ENGINE ── */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={containerRef}>
          {pages.length === 0 ? (
            <div className="pdf-page bg-white" style={{ width: '794px', height: '1123px', position: 'relative', overflow: 'hidden', padding: '40px' }}>
                 <p className="text-center mt-20 font-bold">No Records Found for {title}</p>
            </div>
          ) : (
            pages.map((pageData, pageIndex) => (
                <div
                  key={pageIndex}
                  className="pdf-page bg-white"
                  style={{
                    width: '794px',
                    height: '1123px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '40px 48px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* 1. PERMANENTLY CENTERED BACKGROUND LOGO */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      opacity: 0.15, 
                      width: '75%', 
                      zIndex: 0,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img src={logoSrc} alt="Watermark" style={{ width: '100%', height: 'auto', borderRadius: '50%' }} />
                  </div>
    
                  {/* 2. CONTENT LAYER */}
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    
                    {/* ── HEADER DESIGN: ONLY ON PAGE 1 ── */}
                    {pageIndex === 0 ? (
                      <div style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '2.5px solid #000', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
                          <img src={logoSrc} style={{ height: '70px', width: '70px', borderRadius: '50%' }} />
                          <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#000', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              శ్రీ వరసిద్ధి వినాయక భక్త బృందం
                            </h1>
                            <p style={{ fontSize: '13px', margin: '6px 0 0 0', fontWeight: 'bold', color: '#000', textTransform: 'uppercase', letterSpacing: '2px' }}>
                               {title} Report • {year}
                            </p>
                          </div>
                          <img src={logoSrc} style={{ height: '70px', width: '70px', borderRadius: '50%' }} />
                        </div>
                      </div>
                    ) : (
                      /* Completely Clean Page 2+ (No logos, no titles, no continued text, no underline) */
                      <div style={{ height: '30px' }}></div>
                    )}
    
                    {/* Page Meta Info (Only on Page 1) */}
                    {pageIndex === 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '900', color: '#000', marginBottom: '8px', textTransform: 'uppercase' }}>
                          <span>Category: {title}</span>
                          <span>Page {pageIndex + 1} of {pages.length}</span>
                      </div>
                    )}
    
                    {/* Unified Table Area */}
                    <div style={{ flex: 1 }}>
                      <UnifiedPDFTable 
                        pageData={pageData} 
                        pageIndex={pageIndex} 
                        isLastPage={pageIndex === pages.length - 1} 
                      />
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
};
