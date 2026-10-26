// Announcements search, filter, sort, modal form, file upload, local storage, and like functionality
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const searchInput = $('searchInput'), clearSearchBtn = $('clearSearchBtn');
  const sortSelect = $('sortSelect'), cardGrid = $('cardGrid'), visibleCountEl = $('visibleCount');
  const noResultsEl = $('noResults'), noResultsMsg = $('noResultsMsg'), resetFiltersBtn = $('resetFiltersBtn');
  const sortStatusLabel = $('sortStatusLabel'), filterButtons = document.querySelectorAll('.filter-btn');

  // Modal and file upload elements
  const addModal = $('addAnnouncementModal'), form = $('announcementForm');
  const openHero = $('openModalBtnHero'), openSection = $('openModalBtnSection');
  const closeBtn = $('closeModalBtn'), cancelBtn = $('cancelModalBtn');
  const fileInput = $('formFileInput'), dropzone = $('dropzoneContainer');
  const promptBox = $('dropzonePrompt'), previewBox = $('dropzonePreview');
  const previewName = $('previewFileName'), previewSize = $('previewFileSize'), removeFileBtn = $('removeFileBtn');
  const toast = $('toastNotification'), toastTitle = $('toastTitle'), toastMsg = $('toastMessage');

  // Local storage keys
  const STORAGE_KEY_ANN = 'campus_voice_user_announcements';
  const STORAGE_KEY_LIKES = 'campus_voice_card_likes';

  let currentCategory = 'all', currentSort = 'likes', searchQuery = '', uploadedFile = null;
  const activeFilters = ['bg-brand-700', 'text-white', 'shadow-sm'];
  const inactiveFilters = ['bg-white', 'text-slate-700', 'border', 'border-slate-200', 'hover:bg-slate-50', 'hover:border-slate-300'];

  // Styling maps for category badges and cards
  const CAT_STYLES = {
    academic: { badge: 'text-brand-700 bg-brand-50 border-brand-200', dot: 'bg-brand-600', hover: 'group-hover:text-brand-700', attach: 'text-brand-700 bg-slate-50 hover:bg-brand-50 border-slate-200 hover:border-brand-200', icon: 'text-brand-600' },
    events: { badge: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-600', hover: 'group-hover:text-emerald-700', attach: 'text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 border-emerald-200', icon: 'text-emerald-600' },
    placement: { badge: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', hover: 'group-hover:text-amber-700', attach: 'text-amber-800 bg-amber-50/60 hover:bg-amber-100/80 border-amber-200', icon: 'text-amber-700' }
  };

  // Read saved announcements from localStorage
  const getStoredAnnouncements = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_ANN)) || []; } catch { return []; }
  };

  // Save announcements to localStorage with quota overflow fallback
  const saveStoredAnnouncements = list => {
    try {
      localStorage.setItem(STORAGE_KEY_ANN, JSON.stringify(list));
    } catch {
      const sanitized = list.map(item => item.attachment?.dataUrl ? { ...item, attachment: { ...item.attachment, dataUrl: '' } } : item);
      try { localStorage.setItem(STORAGE_KEY_ANN, JSON.stringify(sanitized)); } catch {}
    }
  };

  // Read saved likes map from localStorage
  const getStoredLikes = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_LIKES)) || {}; } catch { return {}; }
  };

  // Save like state for a card
  const saveCardLike = (cardId, count, isLiked) => {
    if (!cardId) return;
    const likesMap = getStoredLikes();
    likesMap[cardId] = { count, isLiked };
    try { localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(likesMap)); } catch {}
  };

  // Format bytes into human-readable size
  const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  // Set selected file and update preview
  const setSelectedFile = file => {
    if (!file) return resetFileUpload();
    if (file.size > 10 * 1024 * 1024) return alert('File size exceeds 10 MB limit.'), resetFileUpload();
    uploadedFile = file;
    if (previewName) previewName.textContent = file.name;
    if (previewSize) previewSize.textContent = formatFileSize(file.size);
    promptBox?.classList.add('hidden');
    previewBox?.classList.remove('hidden');
  };

  // Reset file upload dropzone state
  const resetFileUpload = () => {
    uploadedFile = null;
    if (fileInput) fileInput.value = '';
    promptBox?.classList.remove('hidden');
    previewBox?.classList.add('hidden');
    dropzone?.classList.remove('border-brand-600', 'bg-brand-50');
  };

  // Update category count badges dynamically
  const updateCategoryCounts = () => {
    const all = document.querySelectorAll('.announcement-card');
    const allBadge = document.querySelector('.filter-btn[data-category="all"] .count-badge');
    if (allBadge) allBadge.textContent = all.length;
    ['academic', 'events', 'placement'].forEach(cat => {
      const count = document.querySelectorAll(`.announcement-card[data-category="${cat}"]`).length;
      const b = document.querySelector(`.filter-btn[data-category="${cat}"] .count-badge`);
      if (b) b.textContent = count;
    });
  };

  // Sort cards based on active criteria
  const sortCards = cards => cards.sort((a, b) => {
    if (currentSort === 'likes') return (+b.dataset.likes || 0) - (+a.dataset.likes || 0);
    if (currentSort === 'az') return (a.dataset.title || '').localeCompare(b.dataset.title || '');
    if (currentSort === 'priority') return (+b.dataset.priority || 0) - (+a.dataset.priority || 0);
    return 0;
  });

  // Filter and re-order cards
  const applyFiltersAndSort = (bumpCardEl = null) => {
    const cards = sortCards(Array.from(document.querySelectorAll('.announcement-card')));
    cards.forEach(card => cardGrid.appendChild(card));

    let visibleCount = 0;
    const q = searchQuery.trim().toLowerCase();

    cards.forEach(card => {
      const matchCat = currentCategory === 'all' || card.dataset.category === currentCategory;
      const matchSearch = !q || card.textContent.toLowerCase().includes(q);
      if (matchCat && matchSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (bumpCardEl) {
      bumpCardEl.classList.remove('card-top-bump');
      void bumpCardEl.offsetWidth;
      bumpCardEl.classList.add('card-top-bump');
    }

    if (visibleCountEl) visibleCountEl.textContent = visibleCount;
    if (sortStatusLabel) {
      sortStatusLabel.textContent = currentSort === 'likes' ? 'Highest Liked / Important' : currentSort === 'az' ? 'Title (A to Z)' : 'Highest Priority';
    }

    if (noResultsEl) {
      if (!visibleCount) {
        noResultsEl.classList.remove('hidden');
        noResultsMsg.textContent = q && currentCategory !== 'all'
          ? `No announcements found matching "${searchQuery}" under ${currentCategory.toUpperCase()}.`
          : q ? `No announcements found matching "${searchQuery}". Please check your spelling or try different keywords.`
          : `No announcements available under ${currentCategory.toUpperCase()} yet.`;
      } else {
        noResultsEl.classList.add('hidden');
      }
    }
  };

  // Attach like button behavior to a button element
  const attachLikeListener = button => {
    button.addEventListener('click', e => {
      e.stopPropagation();
      const card = button.closest('.announcement-card');
      if (!card) return;

      const cardId = card.dataset.id;
      let likes = +card.dataset.likes || 0;
      const isLiked = button.classList.contains('is-liked');
      const countSpan = button.querySelector('.like-count');
      const heartIcon = button.querySelector('.heart-icon');

      likes = isLiked ? Math.max(0, likes - 1) : likes + 1;
      button.classList.toggle('is-liked', !isLiked);
      button.classList.toggle('border-rose-400', !isLiked);
      button.classList.toggle('bg-rose-50', !isLiked);
      button.classList.toggle('text-rose-600', !isLiked);
      button.classList.toggle('ring-2', !isLiked);
      button.classList.toggle('ring-rose-200', !isLiked);
      button.classList.toggle('bg-slate-50', isLiked);
      button.classList.toggle('border-slate-200', isLiked);
      button.classList.toggle('text-slate-600', isLiked);
      heartIcon?.classList.toggle('text-rose-600', !isLiked);

      card.dataset.likes = likes;
      if (countSpan) countSpan.textContent = likes;

      saveCardLike(cardId, likes, !isLiked);
      const userAnn = getStoredAnnouncements();
      const target = userAnn.find(i => i.id === cardId);
      if (target) { target.likes = likes; saveStoredAnnouncements(userAnn); }

      currentSort = 'likes';
      if (sortSelect) sortSelect.value = 'likes';
      applyFiltersAndSort(card);
    });
  };

  // Create an announcement card element from data object
  const createCardElement = data => {
    const { id, title, category, priority, author, customTag, description, dateStr, timeStr, likes, attachment } = data;
    const style = CAT_STYLES[category] || CAT_STYLES.academic;

    const priorityBadgeHtml = customTag
      ? `<span class="text-[10px] sm:text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">${customTag}</span>`
      : priority === '3' ? `<span class="text-[10px] sm:text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-md">Mandatory</span>`
      : priority === '2' ? `<span class="text-[10px] sm:text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">High Priority</span>`
      : `<span class="text-[10px] sm:text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">Notice</span>`;

    const attachmentHtml = attachment?.name ? `
      <div class="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100">
        <a href="${attachment.dataUrl || '#'}" ${attachment.dataUrl ? `download="${attachment.name}" target="_blank"` : ''} class="inline-flex items-center gap-2 text-xs font-semibold ${style.attach} px-3 sm:px-3.5 py-2 rounded-xl transition duration-150 w-full sm:w-auto">
          <svg class="h-4 w-4 ${style.icon} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828A4 4 0 0012.343 4.17L5.757 10.757a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span class="truncate">${attachment.name}</span>
          ${attachment.size ? `<span class="text-[10px] text-slate-400 font-bold ml-auto">(${attachment.size})</span>` : ''}
        </a>
      </div>` : '';

    const card = document.createElement('article');
    card.dataset.id = id;
    card.dataset.category = category;
    card.dataset.title = title;
    card.dataset.priority = priority;
    card.dataset.likes = likes || 0;
    card.className = 'announcement-card bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group';

    card.innerHTML = `
      <div class="p-4 sm:p-6">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase ${style.badge} px-2.5 sm:px-3 py-1 rounded-lg border">
            <span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span>
            ${category.toUpperCase()}
          </span>
          <div class="flex items-center gap-2">
            ${priorityBadgeHtml}
            <button type="button" class="like-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-xs font-bold transition-all active:scale-90" title="Click to like / mark as important (Highest liked card goes to top)">
              <svg class="heart-icon w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span class="like-label font-medium hidden sm:inline">Important</span>
              <span class="like-count text-[11px] font-extrabold text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200">${likes || 0}</span>
            </button>
          </div>
        </div>
        <h3 class="font-poppins text-lg sm:text-xl font-bold text-slate-900 mt-3 sm:mt-4 ${style.hover} transition-colors">${title}</h3>
        <p class="font-baskerville text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">${description}</p>
        ${attachmentHtml}
      </div>
      <div class="bg-slate-50/80 px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <svg class="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="font-medium text-slate-700">${dateStr}</span>
          <span class="text-slate-300">•</span>
          <svg class="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>${timeStr}</span>
        </div>
        <span class="text-[10px] sm:text-[11px] text-slate-400 font-medium">${author}</span>
      </div>`;

    attachLikeListener(card.querySelector('.like-btn'));
    return card;
  };

  // Initialize announcements and restore likes from localStorage
  const initFromStorage = () => {
    getStoredAnnouncements().slice().reverse().forEach(item => cardGrid.prepend(createCardElement(item)));

    const likesMap = getStoredLikes();
    document.querySelectorAll('.announcement-card').forEach(card => {
      const id = card.dataset.id;
      if (id && likesMap[id] !== undefined) {
        const stored = likesMap[id];
        const count = typeof stored === 'object' ? stored.count : stored;
        const isLiked = typeof stored === 'object' ? stored.isLiked : false;

        card.dataset.likes = count;
        const countEl = card.querySelector('.like-count'), likeBtn = card.querySelector('.like-btn'), heart = card.querySelector('.heart-icon');
        if (countEl) countEl.textContent = count;
        if (isLiked && likeBtn) {
          likeBtn.classList.add('is-liked', 'border-rose-400', 'bg-rose-50', 'text-rose-600', 'ring-2', 'ring-rose-200');
          likeBtn.classList.remove('bg-slate-50', 'border-slate-200', 'text-slate-600');
          heart?.classList.add('text-rose-600');
        }
      }
    });

    document.querySelectorAll('.announcement-card:not([data-id^="user_ann_"]) .like-btn').forEach(btn => attachLikeListener(btn));
    updateCategoryCounts();
  };

  // Search input listeners
  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value;
    clearSearchBtn?.classList.toggle('hidden', !searchQuery.length);
    applyFiltersAndSort();
  });

  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    applyFiltersAndSort();
  });

  // Category filter buttons listener
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.category;
      filterButtons.forEach(b => {
        b.classList.remove(...activeFilters);
        b.classList.add(...inactiveFilters);
        const badge = b.querySelector('.count-badge');
        if (badge) badge.className = 'count-badge bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200';
      });
      btn.classList.remove(...inactiveFilters);
      btn.classList.add(...activeFilters);
      const activeBadge = btn.querySelector('.count-badge');
      if (activeBadge) activeBadge.className = 'count-badge bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full';
      applyFiltersAndSort();
    });
  });

  // Sort dropdown change listener
  sortSelect?.addEventListener('change', e => {
    currentSort = e.target.value;
    applyFiltersAndSort();
  });

  // Reset filters listener
  resetFiltersBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchQuery = '';
    clearSearchBtn?.classList.add('hidden');
    currentSort = 'likes';
    if (sortSelect) sortSelect.value = 'likes';
    document.querySelector('.filter-btn[data-category="all"]')?.click();
  });

  // Dropzone file picker and drag-drop listeners
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', e => {
      if (removeFileBtn && removeFileBtn.contains(e.target)) return;
      fileInput.click();
    });
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('border-brand-600', 'bg-brand-50'); });
    dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.classList.remove('border-brand-600', 'bg-brand-50'); });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('border-brand-600', 'bg-brand-50');
      if (e.dataTransfer?.files?.length) setSelectedFile(e.dataTransfer.files[0]);
    });
  }

  fileInput?.addEventListener('change', e => { if (e.target.files?.length) setSelectedFile(e.target.files[0]); });
  removeFileBtn?.addEventListener('click', e => { e.stopPropagation(); resetFileUpload(); });

  // Modal open and close handlers
  const openModal = () => {
    addModal?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => $('formTitle')?.focus(), 50);
  };
  const closeModal = () => {
    addModal?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    form?.reset();
    resetFileUpload();
  };

  const showToast = (title, message) => {
    if (!toast) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastMsg) toastMsg.textContent = message;
    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 4000);
  };

  openHero?.addEventListener('click', openModal);
  openSection?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  addModal?.addEventListener('click', e => { if (e.target === addModal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !addModal?.classList.contains('hidden')) closeModal(); });

  // Handle new announcement form submission
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const title = $('formTitle').value.trim(), category = $('formCategory').value;
    const priority = $('formPriority').value, author = $('formAuthor').value.trim();
    const customTag = $('formTag').value.trim(), description = $('formDescription').value.trim();
    if (!title || !author || !description) return;

    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const finalize = attachment => {
      const newAnn = { id: 'user_ann_' + Date.now(), title, category, priority, author, customTag, description, dateStr, timeStr, likes: 0, attachment };
      const list = getStoredAnnouncements();
      list.unshift(newAnn);
      saveStoredAnnouncements(list);

      const card = createCardElement(newAnn);
      cardGrid.prepend(card);
      updateCategoryCounts();
      closeModal();
      showToast('Announcement Published', 'Announcement saved locally and published.');

      if (currentCategory !== 'all' && currentCategory !== category) {
        document.querySelector('.filter-btn[data-category="all"]')?.click();
      } else {
        applyFiltersAndSort(card);
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (uploadedFile) {
      if (uploadedFile.size <= 2.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => finalize({ name: uploadedFile.name, size: formatFileSize(uploadedFile.size), dataUrl: reader.result });
        reader.onerror = () => finalize({ name: uploadedFile.name, size: formatFileSize(uploadedFile.size), dataUrl: '' });
        reader.readAsDataURL(uploadedFile);
      } else {
        finalize({ name: uploadedFile.name, size: formatFileSize(uploadedFile.size), dataUrl: '' });
      }
    } else {
      finalize(null);
    }
  });

  // College Academic and VTU Calendar dataset
  const calEvents = [
    { id: 'ev1', title: 'Gandhi Jayanti', category: 'holiday', date: '2026-10-02', time: 'All Day', location: 'Campus Wide', description: 'National Holiday commemoration and tribute.' },
    { id: 'ev2', title: 'VTU Internal Assessment 1 (IA-1)', category: 'exam', date: '2026-10-12', time: '09:30 AM - 12:30 PM', location: 'Department Exam Halls', description: 'First continuous internal evaluation for 3rd, 5th, and 7th semester B.E. students.' },
    { id: 'ev3', title: 'Internal Assessment 1 Concludes', category: 'exam', date: '2026-10-17', time: '09:30 AM - 12:30 PM', location: 'Department Exam Halls', description: 'Final day of IA-1 evaluations and lab batch attendance updates.' },
    { id: 'ev4', title: 'VTU Zonal Athletic & Sports Meet', category: 'event', date: '2026-10-20', time: '08:30 AM - 05:30 PM', location: 'College Sports Ground', description: 'Annual inter-collegiate zonal university sports tournament.' },
    { id: 'ev5', title: 'VTU Odd Sem Exam Form Deadline', category: 'academic', date: '2026-10-24', time: 'By 05:00 PM', location: 'Exam Section / Office', description: 'Last date to submit VTU semester examination forms without penal fee.' },
    { id: 'ev6', title: 'Deepavali - Naraka Chaturdashi', category: 'holiday', date: '2026-10-29', time: 'All Day', location: 'Campus Closed', description: 'Festival holiday as per Government of Karnataka calendar.' },
    { id: 'ev7', title: 'Deepavali - Balipadyami', category: 'holiday', date: '2026-10-31', time: 'All Day', location: 'Campus Closed', description: 'State gazetted holiday for Deepavali festival.' },
    { id: 'ev8', title: 'Kannada Rajyotsava Celebration', category: 'holiday', date: '2026-11-01', time: '09:00 AM Flag Hoisting', location: 'Main Administrative Quadrangle', description: 'Karnataka State Formation Day ceremony with flag hoisting.' },
    { id: 'ev9', title: 'TCS & Infosys Campus Placement Drive', category: 'event', date: '2026-11-06', time: '09:00 AM Onwards', location: 'Seminar Hall 1 & Labs', description: 'Tier-1 recruitment drive for eligible final year circuit branch students.' },
    { id: 'ev10', title: 'VTU Internal Assessment 2 (IA-2)', category: 'exam', date: '2026-11-18', time: '09:30 AM - 12:30 PM', location: 'Department Exam Halls', description: 'Second internal assessment cycle across all engineering departments.' },
    { id: 'ev11', title: 'IA-2 Marks Finalization & Freeze', category: 'academic', date: '2026-11-23', time: 'By 04:00 PM', location: 'Department Notice Boards', description: 'Review and submission of CIE marks to VTU portal.' },
    { id: 'ev12', title: 'TechVani 2026 - Annual Technical Fest', category: 'event', date: '2026-11-27', time: '09:30 AM - 06:30 PM', location: 'Auditorium & Campus Lawn', description: 'Hackathon, paper presentations, bot wars, and student innovation showcase.' },
    { id: 'ev13', title: 'Last Working Day of Odd Semester', category: 'academic', date: '2026-12-05', time: '05:00 PM', location: 'All Departments', description: 'Official conclusion of classes and VTU attendance condonation final list.' },
    { id: 'ev14', title: 'VTU Practical Semester Examinations', category: 'exam', date: '2026-12-10', time: '09:00 AM - 05:00 PM', location: 'Department Laboratories', description: 'University external practical examinations commence.' },
    { id: 'ev15', title: 'VTU Theory Semester Examinations', category: 'exam', date: '2026-12-21', time: '02:00 PM - 05:00 PM', location: 'Examination Center', description: 'VTU end-semester theory examinations for all semesters begin.' },
    { id: 'ev16', title: 'Christmas', category: 'holiday', date: '2026-12-25', time: 'All Day', location: 'Campus Closed', description: 'National gazetted holiday.' }
  ];

  // Calendar configuration and state
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let calCurrentYear = 2026, calCurrentMonth = 9; // October 2026 default
  let selectedCalDate = null, calCategoryFilter = 'all';

  // DOM elements for college calendar
  const currentMonthYearEl = $('currentMonthYear');
  const prevMonthBtn = $('prevMonthBtn'), nextMonthBtn = $('nextMonthBtn'), todayCalBtn = $('todayCalBtn');
  const calendarDaysGrid = $('calendarDaysGrid');
  const calendarEventHeader = $('calendarEventHeader'), calendarEventSubheader = $('calendarEventSubheader');
  const showAllMonthEventsBtn = $('showAllMonthEventsBtn'), calendarEventsList = $('calendarEventsList');
  const calFilterBtns = document.querySelectorAll('.cal-filter-btn');

  // Badge and dot styles for calendar event categories
  const CAL_STYLES = {
    exam: { label: 'Exam', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
    academic: { label: 'Academic', dot: 'bg-brand-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    holiday: { label: 'Holiday', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    event: { label: 'Event', dot: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  };

  // Helper to format date into readable text
  const formatReadableDate = dateStr => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Render the calendar days grid for the active month and year
  const renderCalendar = () => {
    if (!calendarDaysGrid || !currentMonthYearEl) return;

    currentMonthYearEl.textContent = `${MONTH_NAMES[calCurrentMonth]} ${calCurrentYear}`;
    calendarDaysGrid.innerHTML = '';

    const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayCell = document.createElement('div');
      prevDayCell.className = 'cal-day-cell empty-day p-1.5 sm:p-2 text-center text-xs text-slate-300 rounded-xl flex flex-col items-center justify-start opacity-40';
      prevDayCell.innerHTML = `<span class="font-medium">${prevMonthDays - i}</span>`;
      calendarDaysGrid.appendChild(prevDayCell);
    }

    // Actual days of current month
    const now = new Date();
    const isCurrentRealMonth = now.getFullYear() === calCurrentYear && now.getMonth() === calCurrentMonth;
    const realTodayDate = now.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = calEvents.filter(ev => ev.date === dateStr);
      const isToday = isCurrentRealMonth && day === realTodayDate;
      const isSelected = selectedCalDate === dateStr;

      const dayCell = document.createElement('button');
      dayCell.type = 'button';
      dayCell.setAttribute('data-date', dateStr);

      let classes = 'cal-day-cell relative p-1.5 sm:p-2 text-center rounded-xl border flex flex-col items-center justify-between cursor-pointer transition ';
      if (isSelected) {
        classes += 'selected-day bg-blue-50 border-blue-600 text-blue-800 font-bold shadow-xs';
      } else if (isToday) {
        classes += 'is-today border-brand-600 bg-slate-50 text-brand-800 font-bold';
      } else if (dayEvents.length > 0) {
        classes += 'border-slate-200 bg-white text-slate-800 font-semibold hover:border-slate-300';
      } else {
        classes += 'border-slate-100 bg-white text-slate-600 hover:border-slate-200';
      }

      dayCell.className = classes;

      // Indicator dots for events on this date
      let dotsHtml = '';
      if (dayEvents.length > 0) {
        const uniqueCategories = [...new Set(dayEvents.map(e => e.category))];
        dotsHtml = '<div class="flex items-center gap-1 mt-1">';
        uniqueCategories.slice(0, 3).forEach(cat => {
          const dotColor = CAL_STYLES[cat]?.dot || 'bg-slate-400';
          dotsHtml += `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>`;
        });
        dotsHtml += '</div>';
      } else {
        dotsHtml = '<div class="h-1.5 mt-1"></div>';
      }

      dayCell.innerHTML = `<span class="text-xs sm:text-sm leading-tight">${day}</span>${dotsHtml}`;

      // Click to toggle day selection
      dayCell.addEventListener('click', () => {
        selectedCalDate = selectedCalDate === dateStr ? null : dateStr;
        renderCalendar();
        renderCalendarEvents();
      });

      calendarDaysGrid.appendChild(dayCell);
    }

    // Leading days into next month to complete 7-col grid
    const totalRendered = firstDayIndex + daysInMonth;
    const remainingSlots = Math.ceil(totalRendered / 7) * 7 - totalRendered;
    for (let j = 1; j <= remainingSlots; j++) {
      const nextDayCell = document.createElement('div');
      nextDayCell.className = 'cal-day-cell empty-day p-1.5 sm:p-2 text-center text-xs text-slate-300 rounded-xl flex flex-col items-center justify-start opacity-40';
      nextDayCell.innerHTML = `<span class="font-medium">${j}</span>`;
      calendarDaysGrid.appendChild(nextDayCell);
    }
  };

  // Render the events agenda list based on selected date and category filter
  const renderCalendarEvents = () => {
    if (!calendarEventsList || !calendarEventHeader || !calendarEventSubheader) return;

    let filtered = calEvents.filter(ev => {
      const [evY, evM] = ev.date.split('-').map(Number);
      const matchesMonth = evY === calCurrentYear && (evM - 1) === calCurrentMonth;
      const matchesDate = selectedCalDate ? ev.date === selectedCalDate : matchesMonth;
      const matchesCat = calCategoryFilter === 'all' || ev.category === calCategoryFilter;
      return matchesDate && matchesCat;
    });

    // Sort chronologically
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    // Update panel headers and reset button
    if (selectedCalDate) {
      calendarEventHeader.textContent = `Schedule: ${formatReadableDate(selectedCalDate)}`;
      calendarEventSubheader.textContent = `${filtered.length} event(s) scheduled on this day`;
      showAllMonthEventsBtn?.classList.remove('hidden');
    } else {
      calendarEventHeader.textContent = `${MONTH_NAMES[calCurrentMonth]} ${calCurrentYear} Schedule`;
      calendarEventSubheader.textContent = `${filtered.length} event(s) found in ${MONTH_NAMES[calCurrentMonth]}`;
      showAllMonthEventsBtn?.classList.add('hidden');
    }

    // Render list or empty state
    calendarEventsList.innerHTML = '';
    if (filtered.length === 0) {
      calendarEventsList.innerHTML = `
        <div class="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <svg class="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm font-semibold text-slate-700">No events scheduled</p>
          <p class="text-xs text-slate-400 mt-1">There are no events matching your active date or filter.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(ev => {
      const style = CAL_STYLES[ev.category] || CAL_STYLES.academic;
      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition duration-150';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${style.badge}">
            <span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span>
            <span>${style.label}</span>
          </span>
          <span class="text-xs font-semibold text-slate-500">${formatReadableDate(ev.date)}</span>
        </div>
        <h5 class="font-display font-bold text-sm text-slate-900 mb-1 leading-snug">${ev.title}</h5>
        <p class="text-xs text-slate-600 mb-2 leading-relaxed">${ev.description}</p>
        <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
          <span class="inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${ev.time}</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>${ev.location}</span>
          </span>
        </div>
      `;
      calendarEventsList.appendChild(card);
    });
  };

  // Month navigation button listeners
  prevMonthBtn?.addEventListener('click', () => {
    calCurrentMonth--;
    if (calCurrentMonth < 0) {
      calCurrentMonth = 11;
      calCurrentYear--;
    }
    selectedCalDate = null;
    renderCalendar();
    renderCalendarEvents();
  });

  nextMonthBtn?.addEventListener('click', () => {
    calCurrentMonth++;
    if (calCurrentMonth > 11) {
      calCurrentMonth = 0;
      calCurrentYear++;
    }
    selectedCalDate = null;
    renderCalendar();
    renderCalendarEvents();
  });

  todayCalBtn?.addEventListener('click', () => {
    const today = new Date();
    calCurrentYear = today.getFullYear();
    calCurrentMonth = today.getMonth();
    selectedCalDate = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    renderCalendar();
    renderCalendarEvents();
  });

  showAllMonthEventsBtn?.addEventListener('click', () => {
    selectedCalDate = null;
    renderCalendar();
    renderCalendarEvents();
  });

  // Calendar category filter button listeners
  calFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      calFilterBtns.forEach(b => {
        b.className = 'cal-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200';
      });
      btn.className = 'cal-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer bg-brand-700 text-white shadow-xs';
      calCategoryFilter = btn.getAttribute('data-cal-filter') || 'all';
      renderCalendarEvents();
    });
  });

  // Smart QR Code and Secure Problem Reporting functionality
  const STORAGE_KEY_TICKETS = 'campus_voice_problem_tickets';

  // Preloaded sample tickets for instant demonstration
  const DEMO_TICKETS = {
    'GEC-84210': {
      id: 'GEC-84210',
      title: 'Lab 2 Wi-Fi access point frequent disconnection',
      category: 'network',
      location: 'CSE & ISE Computing Center (Zone B)',
      urgency: 'high',
      status: 'in_progress',
      isAnonymous: true,
      reportedAt: '24 Oct 2026, 11:20 AM',
      description: 'The ceiling Wi-Fi AP in Lab 2 drops connection intermittently during programming sessions.',
      assignedTo: 'Campus IT Network Cell (Mr. Manjunath)',
      updates: [
        { time: '24 Oct 2026, 11:20 AM', text: 'Ticket received and verified by campus automated dispatch.' },
        { time: '24 Oct 2026, 02:45 PM', text: 'Assigned to Network Operations Team. Firmware patch scheduled.' },
        { time: '25 Oct 2026, 10:00 AM', text: 'Technician on-site inspecting router port switchboard.' }
      ]
    },
    'GEC-62940': {
      id: 'GEC-62940',
      title: 'Block B 2nd floor water cooler filter service',
      category: 'electrical',
      location: 'Student Hostels - Block A & B (Zone D)',
      urgency: 'normal',
      status: 'resolved',
      isAnonymous: true,
      reportedAt: '22 Oct 2026, 09:15 AM',
      description: 'Water dispenser flow rate is slow and requires filter cartridge replacement.',
      assignedTo: 'PWD Maintenance Wing',
      updates: [
        { time: '22 Oct 2026, 09:15 AM', text: 'Ticket registered under Hostel Facility Maintenance.' },
        { time: '22 Oct 2026, 01:30 PM', text: 'Maintenance staff dispatched with replacement RO cartridges.' },
        { time: '23 Oct 2026, 11:00 AM', text: 'Filter replaced, water pressure restored, and sanitization verified.' }
      ]
    },
    'GEC-31050': {
      id: 'GEC-31050',
      title: 'Central Library digital reference terminal monitor flickering',
      category: 'infrastructure',
      location: 'Central Library (Zone A)',
      urgency: 'normal',
      status: 'under_review',
      isAnonymous: false,
      studentUSN: '4GH23CS045',
      reportedAt: '25 Oct 2026, 04:10 PM',
      description: 'Terminal 4 display flickers when brightness is adjusted.',
      assignedTo: 'Library Hardware Assistant',
      updates: [
        { time: '25 Oct 2026, 04:10 PM', text: 'Grievance ticket logged in Library IT Queue.' },
        { time: '26 Oct 2026, 09:30 AM', text: 'Under review by hardware technician for cable check.' }
      ]
    }
  };

  // Read stored tickets from localStorage
  const getStoredTickets = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_TICKETS)) || []; } catch { return []; }
  };

  // Save tickets list to localStorage
  const saveStoredTickets = list => {
    try { localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(list)); } catch {}
  };

  // Smart QR DOM elements
  const qrDisplayContainer = $('qrDisplayContainer');
  const activeStationBadge = $('activeStationBadge');
  const qrCurrentLocationLabel = $('qrCurrentLocationLabel');
  const triggerScanSimulateBtn = $('triggerScanSimulateBtn');
  const downloadQrBtn = $('downloadQrBtn');
  const qrStationButtons = document.querySelectorAll('.qr-station-btn');
  const tabReportFormBtn = $('tabReportFormBtn'), tabTrackStatusBtn = $('tabTrackStatusBtn');
  const reportFormPanel = $('reportFormPanel'), trackStatusPanel = $('trackStatusPanel');
  const problemReportForm = $('problemReportForm'), reportLocationSelect = $('reportLocationSelect');
  const anonymousToggle = $('anonymousToggle'), anonymousStatusLabel = $('anonymousStatusLabel');
  const studentDetailsBox = $('studentDetailsBox'), reportProofDropzone = $('reportProofDropzone');
  const reportProofInput = $('reportProofInput'), reportProofName = $('reportProofName');
  const ticketSearchInput = $('ticketSearchInput'), trackTicketBtn = $('trackTicketBtn');
  const ticketResultContainer = $('ticketResultContainer');
  const demoTicketPills = document.querySelectorAll('.demo-ticket-pill');

  let activeStationLocation = 'Central Library (Zone A)';
  let activeStationZone = 'Zone A';
  let reportProofFile = null;

  // Category badge styles for tickets
  const TICKET_CAT_STYLES = {
    infrastructure: { label: 'Infrastructure', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    network: { label: 'Network & IT', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    electrical: { label: 'Electrical & Water', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    sanitation: { label: 'Sanitation', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    grievance: { label: 'Confidential Grievance', badge: 'bg-rose-50 text-rose-700 border-rose-200' }
  };

  // Urgency badge styles for tickets
  const TICKET_URGENCY_STYLES = {
    normal: { label: 'Normal Priority', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    high: { label: 'High Priority', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    emergency: { label: 'Emergency', badge: 'bg-rose-50 text-rose-700 border-rose-200' }
  };

  // Generate deterministic 25x25 SVG QR matrix based on location string
  const generateSvgQr = seedText => {
    const size = 25;
    const matrix = Array.from({ length: size }, () => Array(size).fill(false));

    // Helper to draw 7x7 finder pattern
    const drawFinder = (startX, startY) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[startY + r][startX + c] = true;
          }
        }
      }
    };

    // Draw three standard QR corner finder patterns
    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Draw timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Generate deterministic hash for data cells
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
      hash = ((hash << 5) - hash) + seedText.charCodeAt(i);
      hash |= 0;
    }

    // Populate data cells avoiding finder patterns, timing patterns, and center logo
    let bitIndex = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= size - 8;
        const inBottomLeft = r >= size - 8 && c < 8;
        const inTiming = r === 6 || c === 6;
        const inCenterLogo = r >= 9 && r <= 15 && c >= 9 && c <= 15;

        if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming && !inCenterLogo) {
          const val = Math.abs((hash ^ (r * 31 + c * 17 + bitIndex * 13))) % 100;
          matrix[r][c] = val > 42;
          bitIndex++;
        }
      }
    }

    // Render SVG elements
    const cellSize = 100 / size;
    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#0f172a" />`;
        }
      }
    }

    return `
      <svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <rect width="100" height="100" fill="#ffffff" />
        ${rects}
        <!-- Center GEC Hassan Shield Emblem -->
        <rect x="36" y="36" width="28" height="28" rx="5" fill="#1e3a8a" stroke="#ffffff" stroke-width="1.5" />
        <text x="50" y="49" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="8.5" text-anchor="middle">GEC</text>
        <text x="50" y="58" fill="#93c5fd" font-family="system-ui, sans-serif" font-weight="700" font-size="4.2" text-anchor="middle">HASSAN</text>
      </svg>
    `;
  };

  // Update QR sticker display with active station
  const updateQrStationDisplay = (location, zone) => {
    activeStationLocation = location;
    activeStationZone = zone;

    if (activeStationBadge) activeStationBadge.textContent = zone;
    if (qrCurrentLocationLabel) qrCurrentLocationLabel.textContent = location;
    if (reportLocationSelect) reportLocationSelect.value = location;

    if (qrDisplayContainer) {
      qrDisplayContainer.innerHTML = generateSvgQr(`GEC_HASSAN_CAMPUS_VOICE_${zone}_${location}`);
    }
  };

  // Station selector button click handling
  qrStationButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      qrStationButtons.forEach(b => {
        b.className = 'qr-station-btn px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition text-left cursor-pointer text-slate-700';
      });
      btn.className = 'qr-station-btn active px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer bg-brand-50 border-brand-500 text-brand-800 shadow-xs';

      const zone = btn.getAttribute('data-zone') || 'Zone';
      const loc = btn.getAttribute('data-location') || 'Central Library (Zone A)';
      updateQrStationDisplay(loc, zone);
    });
  });

  // Switch to report form pre-filled with active station
  const activateReportFormWithStation = () => {
    tabReportFormBtn?.click();
    if (reportLocationSelect) reportLocationSelect.value = activeStationLocation;
    const formSection = $('problemReportForm');
    formSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  triggerScanSimulateBtn?.addEventListener('click', activateReportFormWithStation);

  // Download high-resolution printable QR sticker
  downloadQrBtn?.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw white card background with soft border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 750);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(15, 15, 570, 720);

    // Header branding
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOVT ENGINEERING COLLEGE HASSAN', 300, 65);

    ctx.fillStyle = '#475569';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('Campus Voice - Smart Problem Reporting Station', 300, 95);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText('SCAN TO REPORT PROBLEM', 300, 150);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText('Facility maintenance, electrical, IT & student grievances', 300, 178);

    // Convert SVG to data image and render on canvas
    const svgData = generateSvgQr(`GEC_HASSAN_${activeStationZone}_${activeStationLocation}`);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 125, 210, 350, 350);
      URL.revokeObjectURL(blobURL);

      // Station badge bar
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(60, 590, 480, 50);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 590, 480, 50);

      ctx.fillStyle = '#1d4ed8';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(activeStationLocation, 300, 622);

      // Security footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText('100% Anonymous Protected • SSL Encrypted Campus Helpdesk', 300, 680);

      // Trigger file download
      const a = document.createElement('a');
      a.download = `GEC_Hassan_QR_Sticker_${activeStationZone}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = blobURL;
  });

  // Switch between Report Form and Ticket Tracking tabs
  tabReportFormBtn?.addEventListener('click', () => {
    tabReportFormBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 bg-white text-slate-900 shadow-xs border border-slate-200 cursor-pointer';
    tabTrackStatusBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer';
    reportFormPanel?.classList.remove('hidden');
    trackStatusPanel?.classList.add('hidden');
  });

  tabTrackStatusBtn?.addEventListener('click', () => {
    tabTrackStatusBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 bg-white text-slate-900 shadow-xs border border-slate-200 cursor-pointer';
    tabReportFormBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer';
    trackStatusPanel?.classList.remove('hidden');
    reportFormPanel?.classList.add('hidden');
  });

  // Toggle anonymous reporting mode
  anonymousToggle?.addEventListener('change', () => {
    if (anonymousToggle.checked) {
      if (anonymousStatusLabel) anonymousStatusLabel.textContent = '100% Anonymous';
      studentDetailsBox?.classList.add('hidden');
    } else {
      if (anonymousStatusLabel) anonymousStatusLabel.textContent = 'Verified Identity';
      studentDetailsBox?.classList.remove('hidden');
    }
  });

  // Problem report proof upload handler
  reportProofDropzone?.addEventListener('click', () => reportProofInput?.click());
  reportProofInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
        return;
      }
      reportProofFile = file;
      if (reportProofName) reportProofName.textContent = file.name;
    }
  });

  // Handle problem report submission
  problemReportForm?.addEventListener('submit', e => {
    e.preventDefault();

    const location = reportLocationSelect?.value || 'Central Library (Zone A)';
    const category = $('reportCategory')?.value || 'infrastructure';
    const urgency = document.querySelector('input[name="reportUrgency"]:checked')?.value || 'normal';
    const title = $('reportTitle')?.value.trim();
    const description = $('reportDescription')?.value.trim();
    const isAnonymous = anonymousToggle ? anonymousToggle.checked : true;
    const studentUSN = $('reportStudentUSN')?.value.trim() || '';
    const studentContact = $('reportStudentContact')?.value.trim() || '';

    if (!title || !description) return;

    // Generate unique reference ticket ID
    const ticketId = `GEC-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newTicket = {
      id: ticketId,
      title,
      category,
      location,
      urgency,
      status: 'submitted',
      isAnonymous,
      studentUSN: isAnonymous ? '' : studentUSN,
      studentContact: isAnonymous ? '' : studentContact,
      reportedAt: nowStr,
      description,
      proofName: reportProofFile ? reportProofFile.name : null,
      assignedTo: 'Dispatch in Progress (Automated Router)',
      updates: [
        { time: nowStr, text: 'Secure problem report received and assigned unique reference ticket ID.' },
        { time: 'Pending', text: 'Dispatched to GEC Hassan Facility Maintenance Cell for review.' }
      ]
    };

    // Save ticket to localStorage
    const tickets = getStoredTickets();
    tickets.unshift(newTicket);
    saveStoredTickets(tickets);

    // Reset form fields
    problemReportForm.reset();
    reportProofFile = null;
    if (reportProofName) reportProofName.textContent = 'Attach photo / evidence';
    if (anonymousToggle) anonymousToggle.checked = true;
    if (anonymousStatusLabel) anonymousStatusLabel.textContent = '100% Anonymous';
    studentDetailsBox?.classList.add('hidden');

    // Switch to tracker tab and display the newly created ticket
    tabTrackStatusBtn?.click();
    if (ticketSearchInput) ticketSearchInput.value = ticketId;
    renderTicketStatus(newTicket);

    // Show confirmation toast
    showToast('Report Submitted Securely', `Ticket ${ticketId} created. Track resolution status in real-time.`);
  });

  // Render ticket status tracking card
  const renderTicketStatus = ticket => {
    if (!ticketResultContainer) return;

    const catStyle = TICKET_CAT_STYLES[ticket.category] || TICKET_CAT_STYLES.infrastructure;
    const urgencyStyle = TICKET_URGENCY_STYLES[ticket.urgency] || TICKET_URGENCY_STYLES.normal;

    // Determine current progress step
    const steps = [
      { key: 'submitted', label: 'Submitted' },
      { key: 'under_review', label: 'Under Review' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'resolved', label: 'Resolved' }
    ];

    const currentStepIndex = steps.findIndex(s => s.key === ticket.status);
    const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

    let stepsHtml = '';
    steps.forEach((step, idx) => {
      const isPassed = idx <= activeIndex;
      const isCurrent = idx === activeIndex;
      let circleClass = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ';
      let textClass = 'text-[11px] font-semibold mt-1 ';

      if (isCurrent && ticket.status === 'resolved') {
        circleClass += 'border-emerald-600 bg-emerald-600 text-white';
        textClass += 'text-emerald-700';
      } else if (isCurrent) {
        circleClass += 'border-brand-600 bg-brand-600 text-white';
        textClass += 'text-brand-700 font-bold';
      } else if (isPassed) {
        circleClass += 'border-emerald-500 bg-emerald-50 text-emerald-700';
        textClass += 'text-emerald-800';
      } else {
        circleClass += 'border-slate-200 bg-slate-50 text-slate-400';
        textClass += 'text-slate-400';
      }

      stepsHtml += `
        <div class="flex flex-col items-center flex-1 text-center relative">
          <div class="${circleClass}">
            ${isPassed && !isCurrent ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>' : idx + 1}
          </div>
          <span class="${textClass}">${step.label}</span>
        </div>
      `;
    });

    // Activity log items
    let logHtml = '';
    (ticket.updates || []).forEach(log => {
      logHtml += `
        <div class="flex items-start gap-2.5 text-xs">
          <span class="w-2 h-2 rounded-full bg-brand-600 mt-1.5 flex-shrink-0"></span>
          <div>
            <p class="font-semibold text-slate-800">${log.text}</p>
            <p class="text-[11px] text-slate-400">${log.time}</p>
          </div>
        </div>
      `;
    });

    ticketResultContainer.innerHTML = `
      <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <!-- Ticket Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-base text-slate-900">${ticket.id}</span>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-bold border ${catStyle.badge}">${catStyle.label}</span>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-bold border ${urgencyStyle.badge}">${urgencyStyle.label}</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">${ticket.location} • Reported on ${ticket.reportedAt}</p>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${ticket.isAnonymous ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>${ticket.isAnonymous ? 'Anonymous Report' : (ticket.studentUSN || 'Verified Reporter')}</span>
            </span>
          </div>
        </div>

        <!-- Progress Steps Bar -->
        <div class="py-2">
          <div class="flex items-center justify-between relative">
            <div class="absolute top-3.5 left-6 right-6 h-0.5 bg-slate-200 z-0"></div>
            ${stepsHtml}
          </div>
        </div>

        <!-- Issue Details Box -->
        <div class="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
          <h5 class="font-display font-bold text-sm text-slate-900">${ticket.title}</h5>
          <p class="text-xs text-slate-600 leading-relaxed">${ticket.description}</p>
          ${ticket.proofName ? `<p class="text-[11px] font-semibold text-brand-700">Attachment: ${ticket.proofName}</p>` : ''}
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Assigned Officer: <strong class="text-slate-700">${ticket.assignedTo || 'Facility Support Team'}</strong></span>
          </div>
        </div>

        <!-- Activity Timeline -->
        <div class="space-y-2 pt-1">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Action History & Updates</span>
          <div class="space-y-2.5 pl-1">
            ${logHtml}
          </div>
        </div>
      </div>
    `;
  };

  // Find ticket by ID
  const searchTicketById = id => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;

    // Search local storage first
    const stored = getStoredTickets();
    const foundLocal = stored.find(t => t.id.toUpperCase() === cleanId);
    if (foundLocal) {
      renderTicketStatus(foundLocal);
      return;
    }

    // Search demo tickets
    if (DEMO_TICKETS[cleanId]) {
      renderTicketStatus(DEMO_TICKETS[cleanId]);
      return;
    }

    // Not found state
    if (ticketResultContainer) {
      ticketResultContainer.innerHTML = `
        <div class="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <svg class="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-semibold text-slate-700">Ticket Reference Not Found</p>
          <p class="text-xs text-slate-400 mt-1">No active ticket found with ID "${cleanId}". Please verify your ticket reference number or check the sample IDs above.</p>
        </div>
      `;
    }
  };

  trackTicketBtn?.addEventListener('click', () => {
    if (ticketSearchInput) searchTicketById(ticketSearchInput.value);
  });

  ticketSearchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchTicketById(ticketSearchInput.value);
    }
  });

  // Demo ticket quick buttons
  demoTicketPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const ticketId = pill.getAttribute('data-ticket');
      if (ticketId && ticketSearchInput) {
        ticketSearchInput.value = ticketId;
        searchTicketById(ticketId);
      }
    });
  });

  // Mobile App Bottom Navigation Bar element listeners
  const mobileAppNewPostBtn = $('mobileAppNewPostBtn');
  const mobileAppSearchBtn = $('mobileAppSearchBtn');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-nav]');

  // Open announcement modal from mobile center FAB button
  mobileAppNewPostBtn?.addEventListener('click', openModal);

  // Focus search input when search tab is pressed on mobile
  mobileAppSearchBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => searchInput.focus(), 300);
    }
  });

  // Update active tab in mobile bottom navigation based on scroll position
  const updateMobileNavActiveTab = () => {
    const scrollPos = window.scrollY + 220;
    const sections = [
      { id: 'smart-qr', nav: 'smart-qr' },
      { id: 'calendar', nav: 'calendar' },
      { id: 'feed', nav: 'feed' }
    ];

    for (const sec of sections) {
      const el = $(sec.id);
      if (el && scrollPos >= el.offsetTop) {
        mobileNavItems.forEach(item => {
          if (item.getAttribute('data-nav') === sec.nav) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
        return;
      }
    }
  };

  window.addEventListener('scroll', updateMobileNavActiveTab, { passive: true });

  // Run initial storage load, calendar, and smart QR render
  initFromStorage();
  applyFiltersAndSort();
  renderCalendar();
  renderCalendarEvents();
  updateQrStationDisplay('Central Library (Zone A)', 'Zone A');
  searchTicketById('GEC-84210');
});
