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

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    async function initPdf() {
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;

            totalPages = pdf.numPages;

            const page1 = await pdf.getPage(1);
            const viewport = page1.getViewport({ scale: 1.5 });

            bookWidth = viewport.width;
            bookHeight = viewport.height;

            const pagePromises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                pagePromises.push((async () => {
                    const page = await pdf.getPage(i);
                    const pageViewport = page.getViewport({ scale: 1.5 });

                    // For Horizontal Mode
                    const pageDivH = document.createElement('div');
                    pageDivH.className = 'pdf-page pdf-page-h';
                    if (i === 1 || i === pdf.numPages) {
                        pageDivH.dataset.density = 'hard';
                    }
                    const canvasH = document.createElement('canvas');
                    canvasH.width = pageViewport.width;
                    canvasH.height = pageViewport.height;
                    pageDivH.appendChild(canvasH);

                    // For Vertical Mode
                    const pageDivV = document.createElement('div');
                    pageDivV.className = 'pdf-page pdf-page-v';
                    const canvasV = document.createElement('canvas');
                    canvasV.width = pageViewport.width;
                    canvasV.height = pageViewport.height;
                    pageDivV.appendChild(canvasV);

                    const renderTaskH = page.render({ canvasContext: canvasH.getContext('2d'), viewport: pageViewport }).promise;
                    const renderTaskV = page.render({ canvasContext: canvasV.getContext('2d'), viewport: pageViewport }).promise;

                    // Thumbnail render (page 1 only)
                    let renderTaskThumb = null;
                    if (i === 1) {
                        const thumbBtn = document.getElementById('btn-open-pdf');
                        if (thumbBtn) {
                            const canvasThumb = document.createElement('canvas');
                            canvasThumb.width = pageViewport.width;
                            canvasThumb.height = pageViewport.height;
                            thumbBtn.insertBefore(canvasThumb, thumbBtn.firstChild);
                            renderTaskThumb = page.render({ canvasContext: canvasThumb.getContext('2d'), viewport: pageViewport }).promise;
                        }
                    }

                    await Promise.all([renderTaskH, renderTaskV, renderTaskThumb].filter(Boolean));
                    return { i, pageDivH, pageDivV };
                })());
            }

            if (pdf.numPages % 2 !== 0) {
                const blankH = document.createElement('div');
                blankH.className = 'pdf-page pdf-page-h';
                blankH.dataset.density = 'hard';
                const canvasH = document.createElement('canvas');
                canvasH.width = bookWidth;
                canvasH.height = bookHeight;
                const ctx = canvasH.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, bookWidth, bookHeight);
                blankH.appendChild(canvasH);
                pagePromises.push(Promise.resolve({ i: pdf.numPages + 1, pageDivH: blankH, pageDivV: null }));
                totalPages = pdf.numPages + 1;
            }

            // Resolve all pages concurrently
            const renderedPages = await Promise.all(pagePromises);

            // Sort by page index to append in correct order
            renderedPages.sort((a, b) => a.i - b.i);

            for (const p of renderedPages) {
                if (p.pageDivH) bookEl.appendChild(p.pageDivH);
                if (p.pageDivV) verticalWrapper.appendChild(p.pageDivV);
            }

            const thumbBtn = document.getElementById('btn-open-pdf');
            if (thumbBtn) {
                thumbBtn.classList.add('is-loaded');
            }

            loadingEl.style.display = 'none';

            // Note: initPageFlip() is deferred until horizontal mode is toggled

            // Default to vertical mode
            isVerticalMode = true;
            if (iconVertical) iconVertical.style.display = 'none';
            if (iconHorizontal) iconHorizontal.style.display = 'block';
            container.classList.add('is-vertical');

            wrapper.style.display = 'none';
            verticalWrapper.style.display = 'flex';
            setupScrollObserver();

        } catch (error) {
            console.error("Error loading PDF:", error);
            loadingEl.textContent = "Error loading PDF.";
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

        // Apply exact pixel dimensions to freeze the container and maintain aspect ratio flawlessly
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
            size: "stretch", // Safe to stretch now because bookEl has exact ratio pixel bounds!
            minWidth: 200,
            maxWidth: 3000,
            minHeight: 200,
            maxHeight: 3000,
            maxShadowOpacity: 0.5,
            showCover: true,
            autoCenter: true, // Native autoCenter will now work flawlessly
            usePortrait: false,
            mobileScrollSupport: true,
            useMouseEvents: false, // Disable dragging
            flippingTime: 1 // Disable page turning animation entirely
        });

        pageFlip.loadFromHTML(pages);

        pageFlip.on('flip', (e) => {
            if (!isVerticalMode) {
                let pageText = "";
                if (e.data === 0) {
                    // Cover
                    pageText = `1 / ${totalPages}`;
                } else if (e.data === totalPages - 1 && totalPages % 2 === 0) {
                    // Back Cover
                    pageText = `${totalPages} / ${totalPages}`;
                } else {
                    // Spread
                    pageText = `${e.data + 1}-${e.data + 2} / ${totalPages}`;
                }
                pageNumEl.textContent = pageText;
            }
        });

        pageNumEl.textContent = `1 / ${totalPages}`;
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

                // Lazy initialize PageFlip
                if (!pageFlip) {
                    initPageFlip();
                }

                // Reset zoom
                currentZoom = 1;
                applyTransform();

                // Force update PageFlip to recalculate sizes just in case
                if (pageFlip) pageFlip.update();
            }
        });
    }

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

    function setupScrollObserver() {
        if (scrollObserver) scrollObserver.disconnect();

        const options = {
            root: container, // scroll container
            rootMargin: '0px',
            threshold: 0.5 // 50% visible triggers the page number update
        };

        scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pages = Array.from(document.querySelectorAll('.pdf-vertical-wrapper .pdf-page-v'));
                    const index = pages.indexOf(entry.target);
                    if (index !== -1) {
                        pageNumEl.textContent = `${index + 1} / ${totalPages}`;
                    }
                }
            });
        }, options);

        document.querySelectorAll('.pdf-vertical-wrapper .pdf-page-v').forEach(p => {
            scrollObserver.observe(p);
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
