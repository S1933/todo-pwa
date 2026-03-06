document.addEventListener('DOMContentLoaded', () => {
    const backlogList = document.getElementById('backlog-list');
    const inprogressList = document.getElementById('inprogress-list');
    const doneList = document.getElementById('done-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const newTaskInput = document.getElementById('new-task-input');
    // Fonction pour redimensionner automatiquement un textarea
    const autoResize = (textarea) => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };

    const lists = {
        backlog: backlogList,
        inprogress: inprogressList,
        done: doneList,
    };

    let tasks = [];
    let selectedTaskId = null;
    let activeTagFilter = null;
    let searchQuery = '';

    // Load tasks from server
    const loadTasks = async () => {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                tasks = await response.json();
                renderBoard();
            }
        } catch (err) {
            console.error('Failed to load tasks:', err);
            tasks = [];
        }
    };

    const extractTags = (text) => {
        const tagRegex = /[#@]([a-zA-Z0-9_-]+)/g;
        const tags = [];
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    };

    const removeTagsFromText = (text) => {
        return text.replace(/[#@]([a-zA-Z0-9_-]+)/g, '').trim().replace(/\s+/g, ' ');
    };

    const getTagColor = (tag) => {
        const colors = [
            '#0079bf', '#5aac44', '#ff9f1a', '#eb5a46',
            '#c377e0', '#00c2e0', '#51e898', '#ff78cb'
        ];
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const makeEditable = async (element, task) => {
        const currentText = removeTagsFromText(task.text);
        const taskItem = element.closest('.task-item');
        const input = document.createElement('textarea');
        input.classList.add('edit-input');
        input.value = currentText;
        input.rows = 1;

        // Mettre la tâche en cours d'édition au premier plan
        if (taskItem) {
            taskItem.style.position = 'relative';
            taskItem.style.zIndex = '1000';
        }

        let editSuggestionContainer = null;
        let editTagSuggestions = [];
        let editSelectedIndex = -1;

        const createEditSuggestionContainer = () => {
            const container = document.createElement('div');
            container.classList.add('tag-suggestions');
            container.style.display = 'none';
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(container);
            return container;
        };

        const showEditSuggestions = (query) => {
            if (!editSuggestionContainer) {
                editSuggestionContainer = createEditSuggestionContainer();
            }

            const allTags = getAllUniqueTags();
            editTagSuggestions = query === '' ? allTags : allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()));

            if (editTagSuggestions.length === 0) {
                editSuggestionContainer.style.display = 'none';
                return;
            }

            editSuggestionContainer.innerHTML = '';
            editTagSuggestions.forEach((tag, index) => {
                const item = document.createElement('div');
                item.classList.add('tag-suggestion-item');
                item.textContent = '#' + tag;
                item.dataset.index = index;
                item.style.backgroundColor = getTagColor(tag);
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectEditTag(tag);
                });
                editSuggestionContainer.appendChild(item);
            });

            editSuggestionContainer.style.display = 'block';
            editSuggestionContainer.style.top = (input.offsetTop + input.offsetHeight) + 'px';
            editSuggestionContainer.style.left = input.offsetLeft + 'px';
            editSuggestionContainer.style.width = input.offsetWidth + 'px';
            editSelectedIndex = -1;
        };

        const hideEditSuggestions = () => {
            if (editSuggestionContainer) {
                editSuggestionContainer.style.display = 'none';
            }
            editTagSuggestions = [];
            editSelectedIndex = -1;
        };

        const selectEditTag = (tag) => {
            const cursorPos = input.selectionStart;
            const textBefore = input.value.substring(0, cursorPos);
            const textAfter = input.value.substring(cursorPos);
            const lastHashIndex = textBefore.lastIndexOf('#');
            const lastAtIndex = textBefore.lastIndexOf('@');
            const tagIndex = lastHashIndex > lastAtIndex ? lastHashIndex : lastAtIndex;
            const tagSymbol = lastHashIndex > lastAtIndex ? '#' : '@';
            const newText = textBefore.substring(0, tagIndex) + tagSymbol + tag + ' ' + textAfter;
            input.value = newText;
            const newCursorPos = tagIndex + tag.length + 2;
            input.setSelectionRange(newCursorPos, newCursorPos);
            hideEditSuggestions();
            input.focus();
        };

        const updateEditSelection = () => {
            const items = editSuggestionContainer.querySelectorAll('.tag-suggestion-item');
            items.forEach((item, index) => {
                item.classList.toggle('selected', index === editSelectedIndex);
            });
        };

        input.addEventListener('input', () => {
            autoResize(input);
            const cursorPos = input.selectionStart;
            const textBeforeCursor = input.value.substring(0, cursorPos);
            const lastHashIndex = textBeforeCursor.lastIndexOf('#');
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');
            const lastTagIndex = Math.max(lastHashIndex, lastAtIndex);

            if (lastTagIndex !== -1) {
                const textAfterTag = textBeforeCursor.substring(lastTagIndex + 1);
                const hasSpaceAfterTag = textAfterTag.includes(' ');
                if (!hasSpaceAfterTag) {
                    showEditSuggestions(textAfterTag);
                    return;
                }
            }
            hideEditSuggestions();
        });

        input.addEventListener('keydown', (e) => {
            if (editTagSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    editSelectedIndex = (editSelectedIndex + 1) % editTagSuggestions.length;
                    updateEditSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    editSelectedIndex = editSelectedIndex <= 0 ? editTagSuggestions.length - 1 : editSelectedIndex - 1;
                    updateEditSelection();
                } else if (e.key === 'Enter' && editTagSuggestions.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Sélectionner le premier item si aucun n'est sélectionné
                    const indexToSelect = editSelectedIndex !== -1 ? editSelectedIndex : 0;
                    selectEditTag(editTagSuggestions[indexToSelect]);
                    return;
                } else if (e.key === 'Escape') {
                    hideEditSuggestions();
                }
            }

            if (e.key === 'Enter' && editTagSuggestions.length === 0) {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape' && editTagSuggestions.length === 0) {
                // Réinitialiser le z-index de la tâche avant de quitter
                if (taskItem) {
                    taskItem.style.zIndex = '';
                    taskItem.style.position = '';
                }
                renderBoard();
            }
        });

        const saveEdit = async () => {
            hideEditSuggestions();
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                const oldTags = extractTags(task.text);
                task.text = newText + (oldTags.length > 0 ? ' ' + oldTags.map(t => '#' + t).join(' ') : '');
                task.tags = extractTags(task.text);
                await saveTasks();
            }
            // Réinitialiser le z-index de la tâche
            if (taskItem) {
                taskItem.style.zIndex = '';
                taskItem.style.position = '';
            }
            renderBoard();
        };

        input.addEventListener('blur', saveEdit);

        element.replaceWith(input);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        autoResize(input);
    };

    const normalizeUrl = (url) => {
        if (!url) return url;
        const trimmed = url.trim();
        if (!trimmed.match(/^https?:\/\//i)) {
            return 'http://' + trimmed;
        }
        return trimmed;
    };

    // Modal de recherche
    let searchModal = null;
    let searchInput = null;

    const openSearchModal = () => {
        if (searchModal) {
            searchInput.focus();
            return;
        }

        // Créer le modal
        searchModal = document.createElement('div');
        searchModal.id = 'search-modal';
        searchModal.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);width:90%;max-width:500px;z-index:10001;background:white;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);padding:16px;';

        const searchLabel = document.createElement('div');
        searchLabel.textContent = 'Rechercher une tâche...';
        searchLabel.style.cssText = 'font-size:0.75rem;color:#718096;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;';

        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Tapez pour rechercher...';
        searchInput.style.cssText = 'width:100%;padding:12px 16px;font-size:1rem;border:2px solid #e2e8f0;border-radius:8px;outline:none;box-sizing:border-box;';
        searchInput.value = searchQuery;

        // Filtre dynamique
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            renderBoard();
        });

        // Fermer avec Échap
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearchModal();
            }
        });

        searchModal.appendChild(searchLabel);
        searchModal.appendChild(searchInput);
        document.body.appendChild(searchModal);

        // Overlay pour fermer en cliquant à l'extérieur
        const overlay = document.createElement('div');
        overlay.id = 'search-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,0.3);';
        overlay.addEventListener('click', closeSearchModal);
        document.body.appendChild(overlay);

        searchInput.focus();
    };

    const closeSearchModal = () => {
        if (searchModal) {
            searchModal.remove();
            searchModal = null;
            searchInput = null;
        }
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.remove();
        }
        searchQuery = '';
        renderBoard();
    };

    const saveTasks = async () => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tasks)
            });
            return response.ok;
        } catch (err) {
            console.error('Failed to save tasks:', err);
            return false;
        }
    };

    const renderBoard = () => {
        // Clear all lists
        Object.values(lists).forEach(list => list.innerHTML = '');

        // Show active filter indicator
        let filterIndicator = document.getElementById('filter-indicator');
        if (activeTagFilter) {
            if (!filterIndicator) {
                filterIndicator = document.createElement('div');
                filterIndicator.id = 'filter-indicator';
                filterIndicator.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#2d3748;color:white;padding:8px 16px;border-radius:20px;font-size:0.85rem;z-index:10000;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
                document.body.appendChild(filterIndicator);
            }
            filterIndicator.innerHTML = `Filtré par: <strong>#${activeTagFilter}</strong> <span style="cursor:pointer;font-size:1.2rem;margin-left:4px;" title="Réinitialiser le filtre">×</span>`;
            filterIndicator.querySelector('span').addEventListener('click', () => {
                activeTagFilter = null;
                renderBoard();
            });
            filterIndicator.style.display = 'flex';
        } else if (filterIndicator) {
            filterIndicator.style.display = 'none';
        }

        // Filter tasks by active tag if set
        let filteredTasks = tasks;
        if (activeTagFilter) {
            filteredTasks = tasks.filter(task => task.tags && task.tags.includes(activeTagFilter));
        }

        // Filter tasks by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredTasks = filteredTasks.filter(task =>
                task.text.toLowerCase().includes(query) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        // Sort tasks: pinned first, then by creation date
        const sortedTasks = [...filteredTasks].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
        });

        // Render tasks
        sortedTasks.forEach(task => {
            const list = lists[task.status];
            if (list) {
                const hasPrio = task.tags && task.tags.includes('prio');

                const taskItem = document.createElement('li');
                taskItem.classList.add('task-item');
                if (task.pinned) taskItem.classList.add('pinned');
                if (hasPrio) taskItem.classList.add('prio');
                if (task.id === selectedTaskId) taskItem.classList.add('selected');
                taskItem.dataset.id = task.id;

                taskItem.addEventListener('click', (e) => {
                    if (e.target.classList.contains('edit-input')) {
                        return;
                    }
                    selectedTaskId = task.id;
                    renderBoard();
                });

                const textContent = document.createElement('div');
                textContent.classList.add('task-text');
                textContent.textContent = removeTagsFromText(task.text);
                taskItem.appendChild(textContent);

                // Conteneur pour tags et liens - toujours créé pour afficher le bouton + Lien
                const metadataContainer = document.createElement('div');
                metadataContainer.classList.add('task-metadata');

                // Préparer les tags et liens à afficher
                const displayTags = task.tags ? task.tags.filter(t => t !== 'prio') : [];
                const hasLinks = task.links && task.links.length > 0;

                // Afficher les tags existants (avec préfixe #)
                displayTags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.classList.add('task-tag');
                    if (activeTagFilter === tag) {
                        tagEl.classList.add('active-filter');
                    }
                    tagEl.textContent = '#' + tag;
                    tagEl.style.backgroundColor = getTagColor(tag);

                    // Cliquer sur le tag pour filtrer
                    tagEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (activeTagFilter === tag) {
                            activeTagFilter = null; // Désactiver le filtre si déjà actif
                        } else {
                            activeTagFilter = tag;
                        }
                        renderBoard();
                    });

                    // Bouton de suppression du tag
                    const removeBtn = document.createElement('span');
                    removeBtn.classList.add('tag-remove');
                    removeBtn.textContent = '×';
                    removeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        task.tags = task.tags.filter(t => t !== tag);
                        await saveTasks();
                        renderBoard();
                    });
                    tagEl.appendChild(removeBtn);

                    metadataContainer.appendChild(tagEl);
                });

                // Afficher les liens existants (avec préfixe @)
                if (hasLinks) {
                    task.links.forEach(link => {
                        const linkEl = document.createElement('a');
                        linkEl.classList.add('task-link-badge');
                        linkEl.href = link.url;
                        linkEl.target = '_blank';
                        linkEl.rel = 'noopener noreferrer';
                        linkEl.textContent = '@' + link.title;

                        // Bouton de suppression du lien
                        const removeLinkBtn = document.createElement('span');
                        removeLinkBtn.classList.add('link-remove');
                        removeLinkBtn.textContent = '×';
                        removeLinkBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            task.links = task.links.filter(l => l.url !== link.url);
                            await saveTasks();
                            renderBoard();
                        });

                        linkEl.appendChild(removeLinkBtn);
                        metadataContainer.appendChild(linkEl);
                    });
                }

                // Bouton pour ajouter un lien (sur la même ligne que les tags)
                const addLinkBtn = document.createElement('button');
                addLinkBtn.classList.add('add-link-btn');
                addLinkBtn.textContent = '+ Lien';
                addLinkBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    // Créer une popup personnalisée
                    const modal = document.createElement('div');
                    modal.classList.add('link-modal-overlay');

                    const modalContent = document.createElement('div');
                    modalContent.classList.add('link-modal-content');

                    const titleInput = document.createElement('input');
                    titleInput.type = 'text';
                    titleInput.placeholder = 'Titre du lien';
                    titleInput.classList.add('link-modal-input');

                    const urlInput = document.createElement('input');
                    urlInput.type = 'url';
                    urlInput.placeholder = 'https://exemple.com';
                    urlInput.classList.add('link-modal-input');

                    const buttonsContainer = document.createElement('div');
                    buttonsContainer.classList.add('link-modal-buttons');

                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Annuler';
                    cancelBtn.classList.add('link-modal-btn', 'link-modal-cancel');

                    const saveBtn = document.createElement('button');
                    saveBtn.textContent = 'Ajouter';
                    saveBtn.classList.add('link-modal-btn', 'link-modal-save');

                    buttonsContainer.appendChild(cancelBtn);
                    buttonsContainer.appendChild(saveBtn);

                    modalContent.appendChild(titleInput);
                    modalContent.appendChild(urlInput);
                    modalContent.appendChild(buttonsContainer);
                    modal.appendChild(modalContent);
                    document.body.appendChild(modal);

                    titleInput.focus();

                    const closeModal = () => {
                        document.body.removeChild(modal);
                    };

                    cancelBtn.addEventListener('click', closeModal);

                    saveBtn.addEventListener('click', async () => {
                        const title = titleInput.value.trim();
                        const url = normalizeUrl(urlInput.value.trim());
                        if (title && url) {
                            if (!task.links) task.links = [];
                            task.links.push({ title: title, url: url });
                            await saveTasks();
                            renderBoard();
                        }
                        closeModal();
                    });

                    urlInput.addEventListener('keydown', async (evt) => {
                        if (evt.key === 'Enter') {
                            const title = titleInput.value.trim();
                            const url = normalizeUrl(urlInput.value.trim());
                            if (title && url) {
                                if (!task.links) task.links = [];
                                task.links.push({ title: title, url: url });
                                await saveTasks();
                                renderBoard();
                            }
                            closeModal();
                        }
                    });

                    modal.addEventListener('click', (evt) => {
                        if (evt.target === modal) closeModal();
                    });
                });
                metadataContainer.appendChild(addLinkBtn);

                taskItem.appendChild(metadataContainer);

                taskItem.title = (task.pinned ? 'Épinglée ' : '') + (hasPrio ? 'Prioritaire ' : '') + '(P pour épingler)';
                list.appendChild(taskItem);
            }
        });
    };

    const addTask = async () => {
        const text = newTaskInput.value.trim();
        if (text) {
            const tags = extractTags(text);
            const isPinned = tags.includes('pin');
            const newTask = {
                id: `task-${Date.now()}`,
                text: text,
                status: 'backlog',
                tags: tags.filter(t => t !== 'pin'),
                pinned: isPinned
            };
            tasks.unshift(newTask); // Ajouter au début du tableau pour afficher en haut
            await saveTasks();
            renderBoard();
            newTaskInput.value = '';
            newTaskInput.style.height = 'auto';
        }
    };

    // --- Tag Autocomplete ---
    const getAllUniqueTags = () => {
        const allTags = new Set();
        tasks.forEach(task => {
            if (task.tags) {
                task.tags.forEach(tag => allTags.add(tag));
            }
        });
        return Array.from(allTags).sort();
    };

    let tagSuggestions = [];
    let selectedSuggestionIndex = -1;
    let suggestionContainer = null;

    const createSuggestionContainer = () => {
        const container = document.createElement('div');
        container.classList.add('tag-suggestions');
        container.style.display = 'none';
        newTaskInput.parentElement.appendChild(container);
        return container;
    };

    const showTagSuggestions = (query) => {
        if (!suggestionContainer) {
            suggestionContainer = createSuggestionContainer();
        }

        const allTags = getAllUniqueTags();
        tagSuggestions = query === '' ? allTags : allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()));

        if (tagSuggestions.length === 0) {
            suggestionContainer.style.display = 'none';
            return;
        }

        suggestionContainer.innerHTML = '';
        tagSuggestions.forEach((tag, index) => {
            const item = document.createElement('div');
            item.classList.add('tag-suggestion-item');
            item.textContent = '#' + tag;
            item.dataset.index = index;
            item.style.backgroundColor = getTagColor(tag);
            item.addEventListener('click', () => selectTag(tag));
            suggestionContainer.appendChild(item);
        });

        suggestionContainer.style.display = 'block';
        selectedSuggestionIndex = -1;
    };

    const hideTagSuggestions = () => {
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
        }
        tagSuggestions = [];
        selectedSuggestionIndex = -1;
    };

    const selectTag = (tag) => {
        const cursorPos = newTaskInput.selectionStart;
        const textBefore = newTaskInput.value.substring(0, cursorPos);
        const textAfter = newTaskInput.value.substring(cursorPos);

        const lastHashIndex = textBefore.lastIndexOf('#');
        const lastAtIndex = textBefore.lastIndexOf('@');
        const tagIndex = lastHashIndex > lastAtIndex ? lastHashIndex : lastAtIndex;
        const tagSymbol = lastHashIndex > lastAtIndex ? '#' : '@';
        const newText = textBefore.substring(0, tagIndex) + tagSymbol + tag + ' ' + textAfter;

        newTaskInput.value = newText;
        newTaskInput.focus();
        const newCursorPos = tagIndex + tag.length + 2;
        newTaskInput.setSelectionRange(newCursorPos, newCursorPos);

        hideTagSuggestions();
    };

    const updateSelection = () => {
        const items = suggestionContainer.querySelectorAll('.tag-suggestion-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedSuggestionIndex);
        });
    };

    newTaskInput.addEventListener('input', (e) => {
        autoResize(newTaskInput);
        const cursorPos = newTaskInput.selectionStart;
        const textBeforeCursor = newTaskInput.value.substring(0, cursorPos);
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const lastTagIndex = Math.max(lastHashIndex, lastAtIndex);

        if (lastTagIndex !== -1) {
            const textAfterTag = textBeforeCursor.substring(lastTagIndex + 1);
            const hasSpaceAfterTag = textAfterTag.includes(' ');

            if (!hasSpaceAfterTag) {
                showTagSuggestions(textAfterTag);
                return;
            }
        }
        hideTagSuggestions();
    });

    newTaskInput.addEventListener('keydown', (e) => {
        // Navigation vers les tâches quand il n'y a pas de suggestions de tags
        if (tagSuggestions.length === 0) {
            const columnOrder = ['backlog', 'inprogress', 'done'];
            const currentColumn = 'backlog';

            // Get tasks in backlog column, sorted (pinned first)
            const columnTasks = tasks
                .filter(t => t.status === currentColumn)
                .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return 0;
                });

            if (columnTasks.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                newTaskInput.blur();
                selectedTaskId = columnTasks[0].id;
                renderBoard();
                return;
            }
            return;
        }

        // Navigation dans les suggestions de tags
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = (selectedSuggestionIndex + 1) % tagSuggestions.length;
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? tagSuggestions.length - 1 : selectedSuggestionIndex - 1;
            updateSelection();
        } else if (e.key === 'Enter' && tagSuggestions.length > 0) {
            e.preventDefault();
            // Sélectionner le premier item si aucun n'est sélectionné
            const indexToSelect = selectedSuggestionIndex !== -1 ? selectedSuggestionIndex : 0;
            selectTag(tagSuggestions[indexToSelect]);
        } else if (e.key === 'Escape') {
            hideTagSuggestions();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tag-suggestions') && e.target !== newTaskInput) {
            hideTagSuggestions();
        }
        if (!e.target.closest('.task-item')) {
            selectedTaskId = null;
            renderBoard();
        }
    });

    window.addEventListener('keydown', async (e) => {
        // Fermer la recherche avec Échap (prioritaire)
        if (e.key === 'Escape' && searchModal) {
            e.preventDefault();
            closeSearchModal();
            return;
        }

        // Ouvrir le modal de recherche avec Cmd/Ctrl+Shift+F
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openSearchModal();
            return;
        }

        // Ouvrir le modal de recherche avec la touche /
        if (e.key === '/' && !searchModal) {
            const activeEl = document.activeElement;
            if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')) {
                e.preventDefault();
                openSearchModal();
                return;
            }
        }

        // Ignorer les raccourcis si on est dans un input/textarea (sauf pour les cas ci-dessus)
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            return;
        }

        // Désactiver le filtre de tag avec Échap
        if (e.key === 'Escape' && activeTagFilter) {
            e.preventDefault();
            activeTagFilter = null;
            renderBoard();
            return;
        }

        // Focus sur l'input quand on appuie sur 'n' ou 'N'
        if ((e.key === 'n' || e.key === 'N') && !selectedTaskId && !searchModal) {
            e.preventDefault();
            newTaskInput.focus();
            return;
        }

        const isDeleteKey = e.key === 'Delete' || e.code === 'Delete' || e.keyCode === 46;
        const isBackspaceKey = e.key === 'Backspace' || e.code === 'Backspace' || e.keyCode === 8;

        if ((isDeleteKey || isBackspaceKey) && selectedTaskId) {
            e.preventDefault();
            tasks = tasks.filter(t => t.id !== selectedTaskId);
            selectedTaskId = null;
            await saveTasks();
            renderBoard();
        }

        if ((e.key === 'p' || e.key === 'P') && selectedTaskId) {
            e.preventDefault();
            const task = tasks.find(t => t.id === selectedTaskId);
            if (task) {
                task.pinned = !task.pinned;
                await saveTasks();
                renderBoard();
            }
        }

        const columnOrder = ['backlog', 'inprogress', 'done'];

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();

            const currentTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;
            const currentColumn = currentTask ? currentTask.status : 'backlog';

            // Get tasks in current column, sorted (pinned first)
            const columnTasks = tasks
                .filter(t => t.status === currentColumn)
                .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return 0;
                });

            if (columnTasks.length === 0) return;

            const currentIndex = currentTask ? columnTasks.findIndex(t => t.id === selectedTaskId) : -1;
            let nextIndex;

            if (e.key === 'ArrowUp') {
                // Si on est sur la première tâche et qu'on appuie sur flèche haut, retourner à l'input
                if (currentIndex === 0) {
                    selectedTaskId = null;
                    renderBoard();
                    newTaskInput.focus();
                    return;
                }
                nextIndex = currentIndex <= 0 ? columnTasks.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex === -1 || currentIndex >= columnTasks.length - 1 ? 0 : currentIndex + 1;
            }

            selectedTaskId = columnTasks[nextIndex].id;
            renderBoard();
        }

        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedTaskId) {
            e.preventDefault();
            const task = tasks.find(t => t.id === selectedTaskId);
            if (!task) return;

            const currentColIndex = columnOrder.indexOf(task.status);
            let newColIndex = currentColIndex;

            if (e.key === 'ArrowLeft' && currentColIndex > 0) {
                newColIndex = currentColIndex - 1;
            } else if (e.key === 'ArrowRight' && currentColIndex < columnOrder.length - 1) {
                newColIndex = currentColIndex + 1;
            }

            // Ne déplacer que si la colonne a changé
            if (newColIndex !== currentColIndex) {
                task.status = columnOrder[newColIndex];
                await saveTasks();
                renderBoard();
            }
        }

        if (e.key === 'Enter' && selectedTaskId) {
            e.preventDefault();
            const taskElement = document.querySelector(`.task-item[data-id="${selectedTaskId}"]`);
            if (taskElement) {
                const textElement = taskElement.querySelector('.task-text');
                const task = tasks.find(t => t.id === selectedTaskId);
                if (textElement && task) {
                    makeEditable(textElement, task);
                }
            }
        }
    }, true);

    // --- Event Listeners ---

    addTaskBtn.addEventListener('click', addTask);
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // Drag and Drop désactivé - utiliser les flèches directionnelles pour déplacer les tâches

    // Initial Load
    loadTasks();

    // Auto-focus on input
    newTaskInput.focus();

    document.querySelector('.board-container').addEventListener('click', (e) => {
        const interactiveElements = e.target.closest('.task-item, .delete-btn, #add-task-btn, #new-task-input');
        if (!interactiveElements) {
            newTaskInput.focus();
        }
    });
});
