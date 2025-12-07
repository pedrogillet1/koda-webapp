import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const ExcelPreview = ({ document, zoom }) => {
  const { t } = useTranslation();
  const [htmlContent, setHtmlContent] = useState('');
  const [sheetCount, setSheetCount] = useState(0);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const fetchExcelPreview = async () => {
      if (!document || !document.id) {
        setError(t('excelPreview.documentNotAvailable'));
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/documents/${document.id}/preview`);

        if (response.data.previewType === 'excel') {
          setHtmlContent(response.data.htmlContent || '');
          setSheetCount(response.data.sheetCount || 0);
          setSheets(response.data.sheets || []);
          setLoading(false);
        } else {
          setError(t('excelPreview.invalidPreviewType'));
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading Excel preview:', err);
        setError(t('excelPreview.failedToLoad'));
        setLoading(false);
      }
    };

    fetchExcelPreview();
  }, [document, t]);

  // Show/hide sheets based on active selection
  useEffect(() => {
    if (contentRef.current && sheetCount > 1) {
      const sheetContainers = contentRef.current.querySelectorAll('.sheet-container');
      sheetContainers.forEach((container, index) => {
        container.style.display = index === activeSheet ? 'block' : 'none';
      });
    }
  }, [activeSheet, htmlContent, sheetCount]);

  if (loading) {
    return (
      <div style={{
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        color: '#6C6B6E',
        fontSize: 16,
        fontFamily: 'Plus Jakarta Sans',
        textAlign: 'center'
      }}>
        <div>{t('excelPreview.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
          {t('excelPreview.previewNotAvailable')}
        </div>
        <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
          {document.filename}
        </div>
        <div style={{
          padding: 12,
          background: '#FEF2F2',
          borderRadius: 6,
          fontSize: 14,
          color: '#DC2626',
          marginBottom: 20
        }}>
          {error}
        </div>
      </div>
    );
  }

  // Extract just the body content from the full HTML document
  const extractBodyContent = (html) => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  };

  const scale = zoom / 100;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Sheet Tabs - Only show if multiple sheets */}
      {sheetCount > 1 && (
        <div style={{
          display: 'flex',
          gap: 0,
          background: '#F5F5F5',
          borderBottom: '1px solid #E6E6EC',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {sheets.map((sheet, index) => (
            <button
              key={index}
              onClick={() => setActiveSheet(index)}
              style={{
                padding: '10px 20px',
                background: activeSheet === index ? 'white' : 'transparent',
                border: 'none',
                borderBottom: activeSheet === index ? '2px solid #181818' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: activeSheet === index ? '600' : '400',
                color: activeSheet === index ? '#181818' : '#6C6B6E',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Excel Content - Scrollable container with shift+scroll for horizontal */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'white'
        }}
        onWheel={(e) => {
          // Enable horizontal scroll with shift+wheel or trackpad horizontal gesture
          if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.currentTarget.scrollLeft += e.deltaX || e.deltaY;
            if (e.shiftKey) {
              e.preventDefault();
            }
          }
        }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: scale !== 1 ? `${100 / scale}%` : '100%',
            minWidth: 'max-content'
          }}
          dangerouslySetInnerHTML={{ __html: extractBodyContent(htmlContent) }}
        />
      </div>
    </div>
  );
};

export default ExcelPreview;
