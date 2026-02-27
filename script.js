document.addEventListener('DOMContentLoaded', () => {
    const backlogList = document.getElementById('backlog-list');
    const inprogressList = document.getElementById('inprogress-list');
    const doneList = document.getElementById('done-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const newTaskInput = document.getElementById('new-task-input');

    const lists = {
        backlog: backlogList,
        inprogress: inprogressList,
        done: doneList,
    };

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let draggedTaskId = null;
    let selectedTaskId = null;

    const extractTags = (text) => {
        const tagRegex = /#([a-zA-Z0-9_-]+)/g;
        const tags = [];
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    };

    const removeTagsFromText = (text) => {
        return text.replace(/#([a-zA-Z0-9_-]+)/g, '').trim().replace(/\s+/g, ' ');
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

    const makeEditable = (element, task) => {
        const currentText = removeTagsFromText(task.text);
        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('edit-input');
        input.value = currentText;

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
            const hashIndex = textBefore.lastIndexOf('#');
            const newText = textBefore.substring(0, hashIndex) + '#' + tag + ' ' + textAfter;
            input.value = newText;
            const newCursorPos = hashIndex + tag.length + 2;
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
            const cursorPos = input.selectionStart;
            const textBeforeCursor = input.value.substring(0, cursorPos);
            const lastHashIndex = textBeforeCursor.lastIndexOf('#');

            if (lastHashIndex !== -1) {
                const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
                const hasSpaceAfterHash = textAfterHash.includes(' ');
                if (!hasSpaceAfterHash) {
                    showEditSuggestions(textAfterHash);
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
                } else if (e.key === 'Enter' && editSelectedIndex !== -1) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectEditTag(editTagSuggestions[editSelectedIndex]);
                    return;
                } else if (e.key === 'Escape') {
                    hideEditSuggestions();
                }
            }

            if (e.key === 'Enter' && editTagSuggestions.length === 0) {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape' && editTagSuggestions.length === 0) {
                renderBoard();
            }
        });

        const saveEdit = () => {
            hideEditSuggestions();
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                const oldTags = extractTags(task.text);
                task.text = newText + (oldTags.length > 0 ? ' ' + oldTags.map(t => '#' + t).join(' ') : '');
                task.tags = extractTags(task.text);
                saveTasks();
                renderBoard();
            } else {
                renderBoard();
            }
        };

        input.addEventListener('blur', saveEdit);

        element.replaceWith(input);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    };

    const saveTasks = () => {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    };

    const renderBoard = () => {
        // Clear all lists
        Object.values(lists).forEach(list => list.innerHTML = '');

        // Sort tasks: pinned first, then by creation date
        const sortedTasks = [...tasks].sort((a, b) => {
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
                taskItem.setAttribute('draggable', 'true');
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

                const displayTags = task.tags ? task.tags.filter(t => t !== 'prio') : [];
                if (displayTags.length > 0) {
                    const tagsContainer = document.createElement('div');
                    tagsContainer.classList.add('task-tags');
                    displayTags.forEach(tag => {
                        const tagEl = document.createElement('span');
                        tagEl.classList.add('task-tag');
                        tagEl.textContent = tag;
                        tagEl.style.backgroundColor = getTagColor(tag);
                        tagsContainer.appendChild(tagEl);
                    });
                    taskItem.appendChild(tagsContainer);
                }

                taskItem.title = (task.pinned ? 'Épinglée ' : '') + (hasPrio ? 'Prioritaire ' : '') + '(P pour épingler)';
                list.appendChild(taskItem);
            }
        });
    };

    const addTask = () => {
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
            tasks.push(newTask);
            saveTasks();
            renderBoard();
            newTaskInput.value = '';
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

        const hashIndex = textBefore.lastIndexOf('#');
        const newText = textBefore.substring(0, hashIndex) + '#' + tag + ' ' + textAfter;

        newTaskInput.value = newText;
        newTaskInput.focus();
        const newCursorPos = hashIndex + tag.length + 2;
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
        const cursorPos = newTaskInput.selectionStart;
        const textBeforeCursor = newTaskInput.value.substring(0, cursorPos);
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');

        if (lastHashIndex !== -1) {
            const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
            const hasSpaceAfterHash = textAfterHash.includes(' ');

            if (!hasSpaceAfterHash) {
                showTagSuggestions(textAfterHash);
                return;
            }
        }
        hideTagSuggestions();
    });

    newTaskInput.addEventListener('keydown', (e) => {
        if (tagSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = (selectedSuggestionIndex + 1) % tagSuggestions.length;
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? tagSuggestions.length - 1 : selectedSuggestionIndex - 1;
            updateSelection();
        } else if (e.key === 'Enter' && selectedSuggestionIndex !== -1) {
            e.preventDefault();
            selectTag(tagSuggestions[selectedSuggestionIndex]);
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

    window.addEventListener('keydown', (e) => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        const isDeleteKey = e.key === 'Delete' || e.code === 'Delete' || e.keyCode === 46;
        const isBackspaceKey = e.key === 'Backspace' || e.code === 'Backspace' || e.keyCode === 8;

        if ((isDeleteKey || isBackspaceKey) && selectedTaskId) {
            e.preventDefault();
            tasks = tasks.filter(t => t.id !== selectedTaskId);
            selectedTaskId = null;
            saveTasks();
            renderBoard();
        }

        if ((e.key === 'p' || e.key === 'P') && selectedTaskId) {
            e.preventDefault();
            const task = tasks.find(t => t.id === selectedTaskId);
            if (task) {
                task.pinned = !task.pinned;
                saveTasks();
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
            let newColIndex;

            if (e.key === 'ArrowLeft') {
                newColIndex = currentColIndex <= 0 ? columnOrder.length - 1 : currentColIndex - 1;
            } else {
                newColIndex = currentColIndex >= columnOrder.length - 1 ? 0 : currentColIndex + 1;
            }

            task.status = columnOrder[newColIndex];
            saveTasks();
            renderBoard();
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

    // Drag and Drop
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-item')) {
            draggedTaskId = e.target.dataset.id;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-item')) {
            e.target.classList.remove('dragging');
            draggedTaskId = null;
        }
    });

    Object.values(lists).forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.classList.add('drag-over');
        });

        list.addEventListener('dragleave', (e) => {
            list.classList.remove('drag-over');
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            list.classList.remove('drag-over');
            if (draggedTaskId) {
                const task = tasks.find(t => t.id === draggedTaskId);
                if (task) {
                    task.status = list.dataset.status;
                    saveTasks();
                    renderBoard();
                }
            }
        });
    });

    // Initial Render
    renderBoard();

    // Auto-focus on input
    newTaskInput.focus();

    document.querySelector('.board-container').addEventListener('click', (e) => {
        const interactiveElements = e.target.closest('.task-item, .delete-btn, #add-task-btn, #new-task-input');
        if (!interactiveElements) {
            newTaskInput.focus();
        }
    });
});
