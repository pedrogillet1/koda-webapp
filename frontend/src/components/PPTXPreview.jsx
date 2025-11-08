import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Document, Page, pdfjs } from 'react-pdf';
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as ArrowRightIcon } from '../assets/arrow-narrow-right.svg';

// Configure PDF.js worker - use the same configuration as DocumentViewer
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ✅ FIX: Add CSS animation for spinner
const spinnerStyles = document.createElement('style');
spinnerStyles.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .pptx-spinner {
    animation: spin 1s linear infinite;
  }
`;
if (!document.head.querySelector('#pptx-spinner-styles')) {
  spinnerStyles.id = 'pptx-spinner-styles';
  document.head.appendChild(spinnerStyles);
}

/**
 * Custom PDF Preview Component with KODA Styling
 * Displays PDF with vertical thumbnail sidebar and clean navigation
 */
const PDFPreviewCustom = ({ pdfUrl, document, zoom = 100 }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF preview');
    setLoading(false);
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) setPageNumber(pageNumber - 1);
  };

  const goToNextPage = () => {
    if (pageNumber < numPages) setPageNumber(pageNumber + 1);
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= numPages) setPageNumber(page);
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>📄</div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 16,
          fontFamily: 'Plus Jakarta Sans'
        }}>
          Loading PDF preview...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>⚠️</div>
        <div style={{
          color: '#DC2626',
          fontSize: 16,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '600',
          marginBottom: 8
        }}>
          Failed to Load PDF
        </div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 14,
          fontFamily: 'Plus Jakarta Sans'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      transition: 'transform 0.2s ease'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Navigation Bar */}
        <div style={{
          padding: 16,
          background: '#FAFAFA',
          borderBottom: '1px solid #E6E6EC',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16
        }}>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            style={{
              width: 32,
              height: 32,
              background: pageNumber <= 1 ? '#F5F5F5' : 'white',
              border: '1px solid #E6E6EC',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ArrowLeftIcon style={{
              width: 16,
              height: 16,
              opacity: pageNumber <= 1 ? 0.3 : 1
            }} />
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            color: '#32302C'
          }}>
            <input
              type="number"
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  setPageNumber(page);
                }
              }}
              style={{
                width: 50,
                padding: '4px 8px',
                border: '1px solid #E6E6EC',
                borderRadius: 6,
                textAlign: 'center',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                outline: 'none'
              }}
            />
            <span style={{ color: '#6C6B6E' }}>/ {numPages}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{
              width: 32,
              height: 32,
              background: pageNumber >= numPages ? '#F5F5F5' : 'white',
              border: '1px solid #E6E6EC',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ArrowRightIcon style={{
              width: 16,
              height: 16,
              opacity: pageNumber >= numPages ? 0.3 : 1
            }} />
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{
          display: 'flex',
          height: '700px',
          background: '#FAFAFA'
        }}>
          {/* Thumbnail Sidebar */}
          <div style={{
            width: 200,
            background: 'white',
            borderRight: '1px solid #E6E6EC',
            overflowY: 'auto',
            padding: 12
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#6C6B6E',
              fontFamily: 'Plus Jakarta Sans',
              marginBottom: 12,
              paddingLeft: 4
            }}>
              All Slides
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <Document
                file={pdfUrl}
                onLoadSuccess={() => {}}
                onLoadError={() => {}}
              >
                {Array.from(new Array(numPages), (el, index) => (
                  <div
                    key={`thumb_${index + 1}`}
                    onClick={() => goToPage(index + 1)}
                    style={{
                      cursor: 'pointer',
                      border: pageNumber === index + 1 ? '2px solid #32302C' : '1px solid #E6E6EC',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'white',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <Page
                      pageNumber={index + 1}
                      width={176}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      fontSize: 10,
                      fontFamily: 'Plus Jakarta Sans',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {index + 1}
                    </div>
                  </div>
                ))}
              </Document>
            </div>
          </div>

          {/* Main PDF View */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: 20
          }}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div style={{
                  color: '#6C6B6E',
                  fontSize: 14,
                  fontFamily: 'Plus Jakarta Sans'
                }}>
                  Loading page...
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={800}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                style={{
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}
              />
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PPTX Preview Component
 * Displays PowerPoint presentations with PDF preview (if available) or slide navigation
 */
const PPTXPreview = ({ document, zoom }) => {
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [usePdfPreview, setUsePdfPreview] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, try to get PDF preview if document has pdfPreviewPath
        if (document.pdfPreviewPath) {
          try {
            console.log('📄 Fetching PDF preview...');
            const pdfResponse = await api.get(`/api/documents/${document.id}/pdf-preview`);

            if (pdfResponse.data.success && pdfResponse.data.pdfUrl) {
              setPdfUrl(pdfResponse.data.pdfUrl);
              setUsePdfPreview(true);
              setLoading(false);
              console.log('✅ Using PDF preview');
              return;
            }
          } catch (pdfErr) {
            console.warn('⚠️ PDF preview not available, falling back to slides:', pdfErr.message);
          }
        }

        // Fallback to slide-by-slide view
        console.log('📊 Fetching slide images...');
        const response = await api.get(`/api/documents/${document.id}/slides`);

        if (response.data.success) {
          let slideData = response.data.slides || [];

          // If no slides but we have metadata with extractedText, try to parse it
          if (slideData.length === 0 && document.metadata?.extractedText) {
            console.log('No slides found, parsing from extractedText');
            slideData = parseExtractedText(document.metadata.extractedText);
          }

          setSlides(slideData);
          setMetadata(response.data.metadata || {});

          if (slideData.length === 0) {
            setError(response.data.message || 'No slides available');
          }
        } else {
          setError('Failed to load slides');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching preview:', err);
        setError(err.response?.data?.error || 'Failed to load presentation preview');
        setLoading(false);
      }
    };

    if (document && document.id) {
      fetchPreview();
    }
  }, [document]);

  // Parse extractedText that contains "=== Slide X ===" markers
  const parseExtractedText = (extractedText) => {
    if (!extractedText) return [];

    // Check if this is corrupted XML data (contains schema URLs)
    if (extractedText.includes('schemas.openxmlformats.org') ||
        extractedText.includes('preencoded.png') ||
        extractedText.includes('rId')) {
      console.log('Detected corrupted XML data, skipping parse');
      return [];
    }

    const slideMarkerRegex = /=== Slide (\d+) ===/g;
    const slides = [];
    let match;
    const matches = [];

    // Find all slide markers
    while ((match = slideMarkerRegex.exec(extractedText)) !== null) {
      matches.push({ slideNumber: parseInt(match[1]), index: match.index });
    }

    // Extract content between markers
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];

      const startIndex = currentMatch.index + `=== Slide ${currentMatch.slideNumber} ===`.length;
      const endIndex = nextMatch ? nextMatch.index : extractedText.length;

      let content = extractedText.substring(startIndex, endIndex).trim();

      // Clean up any XML artifacts
      content = content
        .replace(/http:\/\/schemas\.[^\s]+/g, '')
        .replace(/preencoded\.\s*png/g, '')
        .replace(/rId\d+/g, '')
        .replace(/rect\s+/g, '')
        .replace(/ctr\s+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (content.length > 0) {
        slides.push({
          slide_number: currentMatch.slideNumber,
          content: content,
          text_count: content.split('\n').filter(l => l.trim()).length
        });
      }
    }

    return slides;
  };

  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const goToPreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const goToSlide = (index) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index);
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '900px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>📊</div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 16,
          fontFamily: 'Plus Jakarta Sans'
        }}>
          Loading presentation...
        </div>
      </div>
    );
  }

  // Render PDF preview if available
  if (usePdfPreview && pdfUrl) {
    return <PDFPreviewCustom pdfUrl={pdfUrl} document={document} zoom={zoom} />;
  }

  if (error || slides.length === 0) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '900px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 64,
          marginBottom: 20
        }}>📊</div>
        <div style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#32302C',
          fontFamily: 'Plus Jakarta Sans',
          marginBottom: 12
        }}>
          PowerPoint Preview
        </div>
        <div style={{
          fontSize: 14,
          color: '#6C6B6E',
          fontFamily: 'Plus Jakarta Sans',
          marginBottom: 24
        }}>
          {error || 'No slides available. The presentation may still be processing.'}
        </div>
        {metadata && (
          <div style={{
            padding: 16,
            background: '#F5F5F5',
            borderRadius: 8,
            fontSize: 14,
            color: '#6C6B6E',
            fontFamily: 'Plus Jakarta Sans',
            textAlign: 'left'
          }}>
            <div><strong>Title:</strong> {metadata.title || 'N/A'}</div>
            <div><strong>Author:</strong> {metadata.author || 'N/A'}</div>
            <div><strong>Slide Count:</strong> {metadata.slide_count || 0}</div>
          </div>
        )}
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      transition: 'transform 0.2s ease'
    }}>
      {/* Main Slide Display */}
      <div style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Slide Header */}
        <div style={{
          padding: 16,
          background: '#F5F5F5',
          borderBottom: '1px solid #E6E6EC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#32302C',
            fontFamily: 'Plus Jakarta Sans'
          }}>
            Slide {currentSlideIndex + 1} of {slides.length}
          </div>
          {metadata && metadata.title && (
            <div style={{
              fontSize: 12,
              color: '#6C6B6E',
              fontFamily: 'Plus Jakarta Sans'
            }}>
              {metadata.title}
            </div>
          )}
        </div>

        {/* Slide Content */}
        <div style={{
          padding: 20,
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F9FAFB',
          gap: 16
        }}>
          {/* ✅ FIX: Show processing status */}
          {metadata?.slideGenerationStatus === 'processing' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: 20,
              background: '#FFF7ED',
              borderRadius: 8,
              border: '1px solid #FED7AA'
            }}>
              <div className="pptx-spinner" style={{
                width: 40,
                height: 40,
                border: '3px solid #FB923C',
                borderTopColor: 'transparent',
                borderRadius: '50%'
              }} />
              <div style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#EA580C',
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Generating slide images...
              </div>
              <div style={{
                fontSize: 12,
                color: '#9A3412',
                fontFamily: 'Plus Jakarta Sans',
                textAlign: 'center'
              }}>
                This may take a minute. The preview will update automatically.
              </div>
            </div>
          )}

          {/* ✅ FIX: Show error status with retry */}
          {metadata?.slideGenerationStatus === 'failed' && !currentSlide?.imageUrl && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: 20,
              background: '#FEE2E2',
              borderRadius: 8,
              border: '1px solid #FECACA'
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#DC2626',
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Failed to generate slide images
              </div>
              <div style={{
                fontSize: 12,
                color: '#991B1B',
                fontFamily: 'Plus Jakarta Sans',
                textAlign: 'center'
              }}>
                {metadata.slideGenerationError || 'Unknown error'}
              </div>
              <button
                onClick={() => {
                  // TODO: Implement retry logic
                  console.log('Retry slide generation');
                }}
                style={{
                  padding: '8px 16px',
                  background: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'Plus Jakarta Sans'
                }}
              >
                Retry Generation
              </button>
            </div>
          )}

          {/* Show slide image */}
          {currentSlide && currentSlide.imageUrl ? (
            <img
              src={currentSlide.imageUrl}
              alt={`Slide ${currentSlideIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '600px',
                width: 'auto',
                height: 'auto',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onError={(e) => {
                console.error('Failed to load slide image:', currentSlide.imageUrl);
                // ✅ FIX: Show text content as fallback
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : currentSlide && currentSlide.content ? (
            <pre style={{
              margin: 0,
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              lineHeight: 1.8,
              color: '#32302C',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              maxWidth: '100%',
              padding: 20
            }}>
              {currentSlide.content}
            </pre>
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#6C6B6E',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans',
              padding: 40
            }}>
              This slide is empty
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div style={{
          padding: 16,
          background: '#F5F5F5',
          borderTop: '1px solid #E6E6EC',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16
        }}>
          <button
            onClick={goToPreviousSlide}
            disabled={currentSlideIndex === 0}
            style={{
              width: 40,
              height: 40,
              background: currentSlideIndex === 0 ? '#E6E6EC' : 'white',
              border: 'none',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: currentSlideIndex === 0 ? 'none' : '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (currentSlideIndex > 0) {
                e.currentTarget.style.background = '#F5F5F5';
              }
            }}
            onMouseLeave={(e) => {
              if (currentSlideIndex > 0) {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            <ArrowLeftIcon style={{
              width: 20,
              height: 20,
              stroke: currentSlideIndex === 0 ? '#A0A0A0' : '#32302C'
            }} />
          </button>

          <input
            type="number"
            min="1"
            max={slides.length}
            value={currentSlideIndex + 1}
            onChange={(e) => {
              const slideNum = parseInt(e.target.value);
              if (slideNum >= 1 && slideNum <= slides.length) {
                goToSlide(slideNum - 1);
              }
            }}
            style={{
              width: 60,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #E6E6EC',
              fontSize: 14,
              fontWeight: '600',
              fontFamily: 'Plus Jakarta Sans',
              textAlign: 'center',
              outline: 'none'
            }}
          />

          <div style={{
            fontSize: 14,
            color: '#6C6B6E',
            fontFamily: 'Plus Jakarta Sans'
          }}>
            / {slides.length}
          </div>

          <button
            onClick={goToNextSlide}
            disabled={currentSlideIndex === slides.length - 1}
            style={{
              width: 40,
              height: 40,
              background: currentSlideIndex === slides.length - 1 ? '#E6E6EC' : 'white',
              border: 'none',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentSlideIndex === slides.length - 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: currentSlideIndex === slides.length - 1 ? 'none' : '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (currentSlideIndex < slides.length - 1) {
                e.currentTarget.style.background = '#F5F5F5';
              }
            }}
            onMouseLeave={(e) => {
              if (currentSlideIndex < slides.length - 1) {
                e.currentTarget.style.background = 'white';
              }
            }}
          >
            <ArrowRightIcon style={{
              width: 20,
              height: 20,
              stroke: currentSlideIndex === slides.length - 1 ? '#A0A0A0' : '#32302C'
            }} />
          </button>
        </div>
      </div>

      {/* Thumbnail Navigation */}
      <div style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        padding: 16
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: '600',
          color: '#32302C',
          fontFamily: 'Plus Jakarta Sans',
          marginBottom: 12
        }}>
          All Slides
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12,
          maxHeight: 200,
          overflow: 'auto'
        }}>
          {slides.map((slide, index) => (
            <div
              key={index}
              onClick={() => goToSlide(index)}
              style={{
                padding: 8,
                background: index === currentSlideIndex ? '#F5F5F5' : 'white',
                border: index === currentSlideIndex ? '2px solid #181818' : '1px solid #E6E6EC',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (index !== currentSlideIndex) {
                  e.currentTarget.style.background = '#F9FAFB';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentSlideIndex) {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#E6E6EC';
                }
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#32302C',
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Slide {index + 1}
              </div>
              {slide.imageUrl ? (
                <div style={{
                  width: '100%',
                  height: 80,
                  background: '#F9FAFB',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${index + 1} thumbnail`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  fontSize: 11,
                  color: '#6C6B6E',
                  fontFamily: 'Plus Jakarta Sans',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {slide.content ? slide.content.substring(0, 30) + '...' : 'Empty slide'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metadata Info */}
      {metadata && (
        <div style={{
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          padding: 16
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#32302C',
            fontFamily: 'Plus Jakarta Sans',
            marginBottom: 12
          }}>
            Presentation Info
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            fontSize: 13,
            fontFamily: 'Plus Jakarta Sans',
            color: '#6C6B6E'
          }}>
            {metadata.title && (
              <div>
                <strong>Title:</strong> {metadata.title}
              </div>
            )}
            {metadata.author && (
              <div>
                <strong>Author:</strong> {metadata.author}
              </div>
            )}
            {metadata.subject && (
              <div>
                <strong>Subject:</strong> {metadata.subject}
              </div>
            )}
            <div>
              <strong>Total Slides:</strong> {slides.length}
            </div>
            {metadata.created && (
              <div>
                <strong>Created:</strong> {new Date(metadata.created).toLocaleDateString()}
              </div>
            )}
            {metadata.modified && (
              <div>
                <strong>Modified:</strong> {new Date(metadata.modified).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PPTXPreview;
