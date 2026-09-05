document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pdf-viewer-container');
    if (!container) return;

    const pdfUrl = container.getAttribute('data-pdf-url');
    if (!pdfUrl) return;

    const bookEl = document.getElementById('pdf-book');
    const loadingEl = document.getElementById('pdf-loading');
    const pageNumEl = document.getElementById('page-num');

    // Controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const zoomLevelEl = document.getElementById('zoom-level');
    const btnFullscreen = document.getElementById('btn-fullscreen');

    const btnToggleView = document.getElementById('btn-toggle-view');
    const iconVertical = document.getElementById('icon-vertical');
    const iconHorizontal = document.getElementById('icon-horizontal');

    // Wrapper & Zones
    const wrapper = document.getElementById('pdf-book-wrapper');
    const verticalWrapper = document.getElementById('pdf-vertical-wrapper');
    const zonePrev = document.getElementById('zone-prev');
    const zoneNext = document.getElementById('zone-next');

    let currentZoom = 1;
    let pageFlip = null;
    let isDragging = false;
    let startX = 0, startY = 0;
    let translateX = 0, translateY = 0;

    let isVerticalMode = false;
    let bookWidth = 0;
    let bookHeight = 0;
    let totalPages = 1;
    let scrollObserver = null;
    let pageNumObserver = null;

    let pdfDoc = null;
    const pageRendered = new Set();

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    async function initPdf() {
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            pdfDoc = await loadingTask.promise;

            totalPages = pdfDoc.numPages;

            // Fetch page 1 ONLY to calculate layout constraints
            const page1 = await pdfDoc.getPage(1);
            const viewport = page1.getViewport({ scale: 1.5 });

            bookWidth = viewport.width;
            bookHeight = viewport.height;

            const ratio = bookHeight / bookWidth;

            // Bước 1: Khởi tạo tất cả DOM HTML rỗng có chứa lớp 'skeleton-bg'
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                // Horizontal Mode Wrapper
                const pageDivH = document.createElement('div');
                pageDivH.className = 'pdf-page pdf-page-h skeleton-bg';
                pageDivH.dataset.pageIndex = i;
                if (i === 1 || i === pdfDoc.numPages) {
                    pageDivH.dataset.density = 'hard';
                }
                bookEl.appendChild(pageDivH);

                // Vertical Mode Wrapper
                const pageDivV = document.createElement('div');
                pageDivV.className = 'pdf-page pdf-page-v skeleton-bg';
                pageDivV.dataset.pageIndex = i;
                // Force correct layout ratio for vertical items to avoid collapsing before canvas is injected
                pageDivV.style.aspectRatio = `1 / ${ratio}`;
                verticalWrapper.appendChild(pageDivV);
            }

            // Đệm trang trắng nếu tổng số trang bị lẻ (Cho chế độ Horizontal 2-page)
            if (pdfDoc.numPages % 2 !== 0) {
                const blankH = document.createElement('div');
                blankH.className = 'pdf-page pdf-page-h';
                blankH.dataset.density = 'hard';
                blankH.style.backgroundColor = '#ffffff';
                bookEl.appendChild(blankH);
                totalPages = pdfDoc.numPages + 1;
            }

            loadingEl.style.display = 'none';

            // Kích hoạt giao diện mặc định là Vertical
            isVerticalMode = true;
            if (iconVertical) iconVertical.style.display = 'none';
            if (iconHorizontal) iconHorizontal.style.display = 'block';
            container.classList.add('is-vertical');

            wrapper.style.display = 'none';
            verticalWrapper.style.display = 'flex';
            
            // Render luôn trang đầu cho Thumbnail
            renderPage(1);

            // Gắn Observer để Auto Render khi cuộn
            setupScrollObserver();

        } catch (error) {
            console.error("Error loading PDF:", error);
            loadingEl.textContent = "Error loading PDF.";
        }
    }

    async function renderPage(pageNum) {
        if (!pdfDoc || pageNum > pdfDoc.numPages || pageNum < 1) return;
        if (pageRendered.has(pageNum)) return; // Tránh render 2 lần
        pageRendered.add(pageNum);

        try {
            const page = await pdfDoc.getPage(pageNum);
            const pageViewport = page.getViewport({ scale: 1.5 });

            // Inject Canvas Horizontal
            const pageDivH = bookEl.querySelector(`.pdf-page-h[data-page-index="${pageNum}"]`);
            if (pageDivH) {
                const canvasH = document.createElement('canvas');
                canvasH.width = pageViewport.width;
                canvasH.height = pageViewport.height;
                pageDivH.appendChild(canvasH);
                page.render({ canvasContext: canvasH.getContext('2d'), viewport: pageViewport }).promise.then(() => {
                    pageDivH.classList.remove('skeleton-bg');
                });
            }

            // Inject Canvas Vertical
            const pageDivV = verticalWrapper.querySelector(`.pdf-page-v[data-page-index="${pageNum}"]`);
            if (pageDivV) {
                const canvasV = document.createElement('canvas');
                canvasV.width = pageViewport.width;
                canvasV.height = pageViewport.height;
                pageDivV.appendChild(canvasV);
                page.render({ canvasContext: canvasV.getContext('2d'), viewport: pageViewport }).promise.then(() => {
                    pageDivV.classList.remove('skeleton-bg');
                });
            }

            // Thumbnail (Trang 1)
            if (pageNum === 1) {
                const thumbBtn = document.getElementById('btn-open-pdf');
                if (thumbBtn && !thumbBtn.querySelector('canvas')) {
                    const canvasThumb = document.createElement('canvas');
                    canvasThumb.width = pageViewport.width;
                    canvasThumb.height = pageViewport.height;
                    thumbBtn.insertBefore(canvasThumb, thumbBtn.firstChild);
                    page.render({ canvasContext: canvasThumb.getContext('2d'), viewport: pageViewport }).promise.then(() => {
                        thumbBtn.classList.add('is-loaded');
                    });
                }
            }
        } catch (err) {
            console.error("Error rendering page " + pageNum, err);
            pageRendered.delete(pageNum);
        }
    }

    function updateBookSize() {
        if (!wrapper) return;
        const wrapperWidth = wrapper.clientWidth || window.innerWidth;
        const wrapperHeight = wrapper.clientHeight || window.innerHeight;

        // Spread is 2 pages wide
        const ratio = (bookWidth * 2) / bookHeight;

        let newWidth = wrapperWidth;
        let newHeight = wrapperWidth / ratio;

        // If height exceeds wrapper, scale down by height instead
        if (newHeight > wrapperHeight) {
            newHeight = wrapperHeight;
            newWidth = wrapperHeight * ratio;
        }

        // Apply exact pixel dimensions
        bookEl.style.width = `${newWidth}px`;
        bookEl.style.height = `${newHeight}px`;
        bookEl.style.flexShrink = '0'; // Prevent Flexbox from squishing it

        if (pageFlip) {
            pageFlip.update();
        }
    }

    function initPageFlip() {
        const pages = document.querySelectorAll('.pdf-page-h');

        updateBookSize();
        window.addEventListener('resize', () => {
            if (!isVerticalMode) updateBookSize();
        });

        pageFlip = new St.PageFlip(bookEl, {
            width: bookWidth,
            height: bookHeight,
            size: "stretch",
            minWidth: 200,
            maxWidth: 3000,
            minHeight: 200,
            maxHeight: 3000,
            maxShadowOpacity: 0.5,
            showCover: true,
            autoCenter: true,
            usePortrait: false,
            mobileScrollSupport: true,
            useMouseEvents: false,
            flippingTime: 1
        });

        pageFlip.loadFromHTML(pages);

        // Preload first 3 pages on start
        renderPage(1);
        renderPage(2);
        renderPage(3);

        pageFlip.on('flip', (e) => {
            // Lazy load pages based on current spread
            const currentPage = e.data; // 0-indexed page index
            const actualPageNum1 = currentPage + 1;
            const actualPageNum2 = currentPage + 2;

            // Render current spread and preload adjacent spreads
            [actualPageNum1 - 2, actualPageNum1 - 1, actualPageNum1, actualPageNum2, actualPageNum2 + 1, actualPageNum2 + 2].forEach(p => {
                if (p > 0 && pdfDoc && p <= pdfDoc.numPages) {
                    renderPage(p);
                }
            });

            if (!isVerticalMode) {
                let pageText = "";
                if (e.data === 0) {
                    pageText = `1 / ${totalPages}`;
                } else if (e.data === totalPages - 1 && totalPages % 2 === 0) {
                    pageText = `${totalPages} / ${totalPages}`;
                } else {
                    pageText = `${e.data + 1}-${e.data + 2} / ${totalPages}`;
                }
                pageNumEl.textContent = pageText;
            }
        });

        pageNumEl.textContent = `1 / ${totalPages}`;
    }

    function setupScrollObserver() {
        if (scrollObserver) scrollObserver.disconnect();
        if (pageNumObserver) pageNumObserver.disconnect();

        // 1. Observer để Lazy Render
        const renderOptions = {
            root: container,
            rootMargin: '100% 0px', // Preload khi còn cách 1 màn hình
            threshold: 0
        };

        scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pageIndex = parseInt(entry.target.dataset.pageIndex, 10);
                    if (pageIndex) renderPage(pageIndex);
                }
            });
        }, renderOptions);

        // 2. Observer để Cập nhật chỉ số trang (khi cuộn qua 50%)
        const numberOptions = {
            root: container,
            rootMargin: '0px',
            threshold: 0.5
        };

        pageNumObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pageIndex = parseInt(entry.target.dataset.pageIndex, 10);
                    if (pageIndex) {
                        pageNumEl.textContent = `${pageIndex} / ${totalPages}`;
                    }
                }
            });
        }, numberOptions);

        document.querySelectorAll('.pdf-page-v').forEach(p => {
            scrollObserver.observe(p);
            pageNumObserver.observe(p);
        });
    }

    // Toggle View Mode
    if (btnToggleView) {
        btnToggleView.addEventListener('click', () => {
            isVerticalMode = !isVerticalMode;
            if (isVerticalMode) {
                // Switch to Vertical
                if (iconVertical) iconVertical.style.display = 'none';
                if (iconHorizontal) iconHorizontal.style.display = 'block';
                container.classList.add('is-vertical');

                wrapper.style.display = 'none';
                verticalWrapper.style.display = 'flex';

                // Reset zoom
                currentZoom = 1;
                applyTransform();

                setupScrollObserver();
            } else {
                // Switch to Horizontal
                if (iconHorizontal) iconHorizontal.style.display = 'none';
                if (iconVertical) iconVertical.style.display = 'block';
                container.classList.remove('is-vertical');

                verticalWrapper.style.display = 'none';
                wrapper.style.display = 'flex';

                if (scrollObserver) scrollObserver.disconnect();
                if (pageNumObserver) pageNumObserver.disconnect();

                // Lazy initialize PageFlip
                if (!pageFlip) {
                    initPageFlip();
                } else {
                    // Preload adjacent pages of current flip page
                    const currentPage = pageFlip.getCurrentPageIndex();
                    const actualPageNum1 = currentPage + 1;
                    const actualPageNum2 = currentPage + 2;
                    [actualPageNum1, actualPageNum2].forEach(p => {
                        if (p > 0 && pdfDoc && p <= pdfDoc.numPages) renderPage(p);
                    });
                }

                // Reset zoom
                currentZoom = 1;
                applyTransform();

                // Force update PageFlip to recalculate sizes
                if (pageFlip) pageFlip.update();
            }
        });
    }

    // Event listeners for zones
    if (zonePrev) {
        zonePrev.addEventListener('click', () => {
            if (currentZoom === 1 && pageFlip && !isVerticalMode) pageFlip.flipPrev();
        });
    }
    if (zoneNext) {
        zoneNext.addEventListener('click', () => {
            if (currentZoom === 1 && pageFlip && !isVerticalMode) pageFlip.flipNext();
        });
    }

    // Zoom Logic
    function applyTransform() {
        const targetWrapper = isVerticalMode ? verticalWrapper : wrapper;
        const otherWrapper = isVerticalMode ? wrapper : verticalWrapper;

        // Reset the other wrapper
        otherWrapper.style.transform = `scale(1) translate(0px, 0px)`;
        otherWrapper.classList.remove('is-zoomed');

        if (currentZoom === 1) {
            translateX = 0;
            translateY = 0;
            targetWrapper.style.transform = `scale(1)`;
            targetWrapper.classList.remove('is-zoomed');
            container.classList.remove('is-zoomed');
        } else {
            targetWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
            targetWrapper.classList.add('is-zoomed');
            container.classList.add('is-zoomed');
        }
        if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            if (currentZoom < 2.5) {
                currentZoom += 0.25;
                applyTransform();
            }
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            if (currentZoom > 0.5) {
                currentZoom -= 0.25;
                applyTransform();
            }
        });
    }

    // Drag to Pan Logic
    function attachDrag(el) {
        el.addEventListener('mousedown', (e) => {
            if (currentZoom > 1) {
                isDragging = true;
                el.classList.add('is-dragging');
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
            }
        });
    }

    attachDrag(wrapper);
    attachDrag(verticalWrapper);

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            wrapper.classList.remove('is-dragging');
            verticalWrapper.classList.remove('is-dragging');
        }
    });

    // Prevent default drag behavior on images/canvas
    container.addEventListener('dragstart', (e) => e.preventDefault());

    // Open PDF Fullscreen from Thumbnail
    const thumbBtn = document.getElementById('btn-open-pdf');
    if (thumbBtn) {
        thumbBtn.addEventListener('click', (e) => {
            if (!thumbBtn.classList.contains('is-loaded')) {
                e.preventDefault();
                return;
            }
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        });
    }

    // Fullscreen Logic
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Run
    initPdf();
});
