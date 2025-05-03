<template>
    <q-page padding>
      <div class="q-mb-md row justify-between items-center">
        <div class="text-h5">Manage Categories & Lists</div>
        <q-btn
          label="Create Category"
          color="primary"
          icon="add"
          @click="openCreateCategoryDialog"
          :disable="savingCategory || deletingCategory"
        />
      </div>
  
      <!-- Filtering Section -->
      <q-card class="q-mb-md" flat bordered>
        <q-card-section class="q-gutter-md row items-end">
          <q-input
            dense outlined v-model="categoryFilters.name" label="Filter by Name"
            class="col-12 col-sm-4" clearable @update:model-value="debouncedFetchCategories"
            :disable="loadingCategories"
          />
          <q-select
            dense outlined v-model="categoryFilters.status" :options="categoryStatusOptions"
            label="Filter by Status" class="col-12 col-sm-3" emit-value map-options clearable
            @update:model-value="debouncedFetchCategories" :disable="loadingCategories"
          />
          <q-space />
          <q-btn flat round dense icon="refresh" @click="refreshCategories" :loading="loadingCategories" title="Refresh Categories"/>
        </q-card-section>
      </q-card>
  
      <!-- Categories Table -->
      <q-table
        :rows="categories"
        :columns="categoryColumns"
        row-key="id"
        :loading="loadingCategories"
        flat bordered
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="getStatusColor(props.value)" :label="props.value || 'N/A'" />
          </q-td>
        </template>
  
         <template v-slot:body-cell-listCount="props">
          <q-td :props="props">
            {{ props.row._count?.lists ?? 0 }}
          </q-td>
        </template>
  
        <template v-slot:body-cell-actions="props">
          <q-td :props="props" class="q-gutter-xs">
            <q-btn dense flat round icon="visibility" color="info" @click="openViewCategoryDialog(props.row)" title="View Details & Lists" />
            <q-btn dense flat round icon="edit" color="primary" @click="openEditCategoryDialog(props.row)" title="Edit Category" />
            <q-btn dense flat round icon="delete" color="negative" @click="confirmDeleteCategory(props.row)" title="Delete Category" />
          </q-td>
        </template>
  
        <template v-slot:no-data>
           <div class="full-width row flex-center text-grey q-gutter-sm q-pa-md">
             <q-icon size="2em" name="sentiment_dissatisfied" />
             <span>No categories found matching your criteria.</span>
             <q-btn flat dense label="Clear Filters?" @click="refreshCategories" v-if="categoryFilters.name || categoryFilters.status"/>
             <q-btn flat dense label="Create one?" @click="openCreateCategoryDialog"/>
           </div>
         </template>
  
         <template v-slot:loading>
           <q-inner-loading showing color="primary" />
         </template>
      </q-table>
  
      <!-- Category Create/Edit Dialog -->
      <q-dialog v-model="categoryDialog.show" persistent>
        <q-card style="min-width: 400px; max-width: 90vw;">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">{{ categoryDialog.isEdit ? 'Edit Category' : 'Create Category' }}</div>
             <q-space />
             <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>
  
          <q-form @submit.prevent="saveCategory" ref="categoryFormRef">
            <q-card-section class="q-gutter-md">
              <q-input
                autofocus filled dense
                v-model="categoryDialog.data.name" label="Category Name *"
                :rules="[val => !!val || 'Name is required', val => (val && val.length <= 255) || 'Max 255 chars']"
                lazy-rules counter maxlength="255"
              />
              <q-select
                filled dense
                v-model="categoryDialog.data.status" :options="categoryStatusOptions" label="Status"
                emit-value map-options clearable hint="Defaults to 'active' if left empty"
              />
            </q-card-section>
  
            <q-card-actions align="right" class="q-pa-md">
              <q-btn flat label="Cancel" v-close-popup color="grey" />
              <q-btn
                type="submit" :label="categoryDialog.isEdit ? 'Update' : 'Create'" color="primary"
                :loading="savingCategory"
              />
            </q-card-actions>
          </q-form>
        </q-card>
      </q-dialog>
  
      <!-- Category View/List Management Dialog -->
      <q-dialog v-model="viewDialog.show" full-width full-height persistent maximized>
         <q-card class="column full-height">
           <q-card-section class="row items-center q-pb-none bg-primary text-white">
             <div class="text-h6">Category: {{ viewDialog.category?.name }}</div>
             <q-space />
             <q-btn icon="close" flat round dense v-close-popup color="white"/>
           </q-card-section>
  
          <q-card-section class="col q-pt-none" style="overflow-y: auto;">
              <div class="q-my-md row justify-between items-center sticky-top bg-white q-py-sm" style="top: 0; z-index: 1;"> <!-- Make controls sticky -->
                   <div class="text-subtitle1">List Items ({{ listPagination.totalItems }})</div>
                   <q-btn
                      label="Add Item" color="secondary" icon="add" size="sm"
                      @click="openCreateListDialog(viewDialog.category?.id)"
                      :disable="!viewDialog.category?.id || savingList || deletingList"
                   />
               </div>
  
               <!-- List Filters -->
               <q-card class="q-mb-md" flat bordered>
                   <q-card-section class="q-gutter-sm row items-end">
                       <q-input dense outlined v-model="listFilters.item" label="Filter Item" class="col-12 col-sm-4" clearable @update:model-value="debouncedFetchLists" :disable="loadingLists"/>
                       <q-select dense outlined v-model="listFilters.status" :options="listStatusOptions" label="Filter Status" class="col-12 col-sm-3" emit-value map-options clearable @update:model-value="debouncedFetchLists" :disable="loadingLists" />
                       <q-space/>
                       <q-btn flat round dense icon="refresh" @click="() => refreshLists(viewDialog.category?.id)" :loading="loadingLists" title="Refresh List"/>
                   </q-card-section>
               </q-card>
  
               <!-- List Table -->
              <q-table
                 :rows="lists" :columns="listColumns" row-key="id"
                 :loading="loadingLists"

              
                 class="q-mt-md" flat bordered dense
              >
                  <template v-slot:body-cell-status="props">
                      <q-td :props="props">
                         <q-badge :color="getListStatusColor(props.value)" :label="props.value || 'N/A'" />
                      </q-td>
                  </template>
                   <template v-slot:body-cell-item="props">
                      <q-td :props="props" style="white-space: normal; word-break: break-word;">
                         {{ props.value }}
                      </q-td>
                  </template>
                  <template v-slot:body-cell-actions="props">
                   <q-td :props="props" class="q-gutter-xs">
                     <q-btn dense flat round icon="edit" color="primary" @click="openEditListDialog(props.row)" title="Edit Item" />
                     <q-btn dense flat round icon="delete" color="negative" @click="confirmDeleteList(props.row)" title="Delete Item" />
                   </q-td>
                 </template>
                 <template v-slot:no-data>
                   <div class="full-width row flex-center text-grey q-gutter-sm q-pa-md">
                      <q-icon size="2em" name="sentiment_dissatisfied" />
                      <span>No list items found matching your criteria.</span>
                      <q-btn flat dense label="Clear Filters?" @click="() => refreshLists(viewDialog.category?.id)" v-if="listFilters.item || listFilters.status"/>
                    </div>
                 </template>
                  <template v-slot:loading>
                      <q-inner-loading showing color="secondary" />
                  </template>
              </q-table>
           </q-card-section>
         </q-card>
       </q-dialog>
  
       <!-- List Item Create/Edit Dialog -->
        <q-dialog v-model="listDialog.show" persistent>
          <q-card style="min-width: 400px; max-width: 90vw;">
             <q-card-section class="row items-center q-pb-none">
                <div class="text-h6">{{ listDialog.isEdit ? 'Edit List Item' : 'Create List Item' }}</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
             </q-card-section>
  
            <q-form @submit.prevent="saveList" ref="listFormRef">
              <q-card-section class="q-pt-none q-gutter-md">
                <q-input
                  autofocus filled dense
                  v-model="listDialog.data.item" label="Item Description *"
                  :rules="[val => !!val || 'Item description is required', val => (val && val.length <= 500) || 'Max 500 chars']"
                  lazy-rules type="textarea" autogrow counter maxlength="500"
                />
                <q-select
                  filled dense
                  v-model="listDialog.data.status" :options="listStatusOptions" label="Status"
                  emit-value map-options clearable hint="Defaults to 'active' if left empty"
                />
                 <q-select
                   v-if="listDialog.isEdit"
                   filled dense
                   v-model="listDialog.data.categoryId" :options="categoryOptionsForSelect" label="Move to Category"
                   emit-value map-options
                   :rules="[val => !!val || 'Category is required']"
                   :loading="loadingCategoryOptions" lazy-rules
                   hint="Select a new category for this item"
                   />
              </q-card-section>
  
              <q-card-actions align="right" class="q-pa-md">
                <q-btn flat label="Cancel" color="grey" v-close-popup />
                <q-btn
                  type="submit" :label="listDialog.isEdit ? 'Update' : 'Create'" color="primary"
                  :loading="savingList"
                />
              </q-card-actions>
            </q-form>
          </q-card>
        </q-dialog>
  
    </q-page>
  </template>
  
  <script setup lang="ts">
  import { ref, reactive, onMounted, computed, watch } from 'vue';
  import { useQuasar, QTableProps, QTableColumn, debounce, QForm } from 'quasar';
  import { CategoryService } from '../services/CategoryService'; // Adjust path
  import type {
      Category, List, CreateCategoryDto, UpdateCategoryDto, CreateListDto,
      UpdateListDto, FilterCategoryDto, FilterListDto, PaginationMeta
  } from '../types/models'; // Adjust path
  
  const $q = useQuasar();
  
  // --- Local State ---
  const categories = ref<Category[]>([]);
  const lists = ref<List[]>([]); // Lists for the view dialog
  
  // --- Default Pagination Meta --- (Helper)
  const defaultMeta: PaginationMeta = {
    totalItems: 0, itemsPerPage: 10, totalPages: 1, currentPage: 1,
  };
  const defaultListMeta: PaginationMeta = {
    totalItems: 0, itemsPerPage: 10, totalPages: 1, currentPage: 1,
  };
  
  // --- Pagination & Filters ---
  const categoryPagination = ref<PaginationMeta>({ ...defaultMeta });
  const listPagination = ref<PaginationMeta>({ ...defaultListMeta });
  const categoryFilters = reactive<FilterCategoryDto>({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
  const listFilters = reactive<FilterListDto>({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
  
  // --- Loading States ---
  const loadingCategories = ref(false);
  const loadingLists = ref(false);
  const savingCategory = ref(false);
  const deletingCategory = ref(false);
  const savingList = ref(false);
  const deletingList = ref(false);
  const loadingCategoryOptions = ref(false);
  
  // --- Dialog States & Data ---
  const categoryDialog = reactive({
    show: false, isEdit: false,
    data: { id: undefined as number | undefined, name: '', status: undefined as string | undefined } as UpdateCategoryDto & { id?: number },
  });
  const viewDialog = reactive<{ show: boolean; category: Category | null }>({ show: false, category: null });
  const listDialog = reactive({
    show: false, isEdit: false,
    data: { id: undefined as number | undefined, item: '', status: undefined as string | undefined, categoryId: 0 } as UpdateListDto & { id?: number, categoryId?: number },
    originalCategoryId: 0, // Track original category for updates
  });
  
  const categoryFormRef = ref<QForm | null>(null);
  const listFormRef = ref<QForm | null>(null);
  const categoryOptionsForSelect = ref<{ label: string; value: number }[]>([]);
  
  // --- Computed Table Bindings ---
  const categoryServerPagination = computed<QTableProps['pagination']>({
    get: () => ({
      page: categoryPagination.value.currentPage,
      rowsPerPage: categoryPagination.value.itemsPerPage,
      rowsNumber: categoryPagination.value.totalItems,
      sortBy: categoryFilters.sortBy,
      descending: categoryFilters.sortOrder === 'desc',
    }),
    set: (val) => {
      categoryFilters.page = val?.page ?? 1;
      categoryFilters.limit = val?.rowsPerPage === 0 ? 10000 : val?.rowsPerPage ?? 10; // High limit for 'All'
      categoryFilters.sortBy = val?.sortBy as FilterCategoryDto['sortBy'] ?? 'createdAt';
      categoryFilters.sortOrder = val?.descending ? 'desc' : 'asc';
      // QTable triggers @request, no need to fetch here directly
    }
  });
  
  const listServerPagination = computed<QTableProps['pagination']>({
    get: () => ({
      page: listPagination.value.currentPage,
      rowsPerPage: listPagination.value.itemsPerPage,
      rowsNumber: listPagination.value.totalItems,
      sortBy: listFilters.sortBy,
      descending: listFilters.sortOrder === 'desc',
    }),
    set: (val) => {
      listFilters.page = val?.page ?? 1;
      listFilters.limit = val?.rowsPerPage === 0 ? 10000 : val?.rowsPerPage ?? 10;
      listFilters.sortBy = val?.sortBy as FilterListDto['sortBy'] ?? 'createdAt';
      listFilters.sortOrder = val?.descending ? 'desc' : 'asc';
      // QTable triggers @request
    }
  });
  
  // --- Table Column Definitions ---
  const categoryColumns: QTableColumn<Category>[] = [
    { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
    { name: 'status', label: 'Status', field: 'status', align: 'center', sortable: true },
    { name: 'listCount', label: 'Items', field: (row) => row._count?.lists ?? 0, align: 'center', sortable: false },
    { name: 'createdAt', label: 'Created', field: 'createdAt', format: (val) => new Date(val).toLocaleDateString(), align: 'left', sortable: true },
    { name: 'updatedAt', label: 'Updated', field: 'updatedAt', format: (val) => new Date(val).toLocaleDateString(), align: 'left', sortable: true },
    { name: 'actions', label: 'Actions', field: 'actions', align: 'right', sortable: false },
  ];
  
  const listColumns: QTableColumn<List>[] = [
    { name: 'item', label: 'Item', field: 'item', align: 'left', sortable: true, style: 'max-width: 400px; white-space: normal; word-break: break-word;' }, // Allow wrapping
    { name: 'status', label: 'Status', field: 'status', align: 'center', sortable: true },
    { name: 'createdAt', label: 'Created', field: 'createdAt', format: (val) => new Date(val).toLocaleDateString(), align: 'left', sortable: true },
    { name: 'updatedAt', label: 'Updated', field: 'updatedAt', format: (val) => new Date(val).toLocaleDateString(), align: 'left', sortable: true },
    { name: 'actions', label: 'Actions', field: 'actions', align: 'right', sortable: false },
  ];
  
  // --- Options for Selects ---
  const categoryStatusOptions = [ { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' } ];
  const listStatusOptions = [ { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Completed', value: 'completed' } ];
  
  // --- API Interaction Methods ---
  const fetchCategories = async () => {
    loadingCategories.value = true;
    try {
      const response = await CategoryService.getCategories(categoryFilters);
      categories.value = response.data;
      categoryPagination.value = response.meta;
    } catch (error) {
      handleApiError(error, 'fetching categories');
      categories.value = []; // Clear data on error
      categoryPagination.value = { ...defaultMeta }; // Reset pagination
    } finally {
      loadingCategories.value = false;
    }
  };
  const debouncedFetchCategories = debounce(fetchCategories, 400);
  
  const fetchListsForCategory = async (categoryId?: number) => {
    const idToFetch = categoryId ?? viewDialog.category?.id;
    if (!idToFetch) return;
  
    loadingLists.value = true;
    try {
      const response = await CategoryService.getListsForCategory(idToFetch, listFilters);
      lists.value = response.data;
      listPagination.value = response.meta;
    } catch (error) {
      handleApiError(error, `fetching lists for category ID ${idToFetch}`);
      lists.value = [];
      listPagination.value = { ...defaultListMeta };
    } finally {
      loadingLists.value = false;
    }
  };
  const debouncedFetchLists = debounce(fetchListsForCategory, 400);
  
  const refreshCategories = () => {
    categoryFilters.name = undefined;
    categoryFilters.status = undefined;
    categoryFilters.page = 1; // Reset to first page
    fetchCategories(); // Fetch immediately
  };
  
  const refreshLists = (categoryId?: number) => {
    if (!categoryId && viewDialog.category?.id) categoryId = viewDialog.category.id;
    if (!categoryId) return;
    listFilters.item = undefined;
    listFilters.status = undefined;
    listFilters.page = 1;
    fetchListsForCategory(categoryId); // Fetch immediately
  };
  
  // --- Category CRUD ---
  function openCreateCategoryDialog() {
    categoryDialog.isEdit = false;
    categoryDialog.data = { id: undefined, name: '', status: undefined }; // Reset form
    categoryDialog.show = true;
  }
  
  function openEditCategoryDialog(category: Category) {
    categoryDialog.isEdit = true;
    // Make a copy to avoid mutating table row directly
    categoryDialog.data = { id: category.id, name: category.name, status: category.status ?? undefined };
    categoryDialog.show = true;
  }
  
  async function saveCategory() {
    const isValid = await categoryFormRef.value?.validate();
    if (!isValid) return;
  
    savingCategory.value = true;
    try {
      const payload = { ...categoryDialog.data };
      if (!payload.status) delete payload.status; // Send null/undefined or omit if backend defaults
  
      if (categoryDialog.isEdit && payload.id) {
        await CategoryService.updateCategory(payload.id, payload);
        $q.notify({ type: 'positive', message: 'Category updated!' });
      } else {
        await CategoryService.createCategory(payload as CreateCategoryDto);
        $q.notify({ type: 'positive', message: 'Category created!' });
      }
      categoryDialog.show = false;
      await fetchCategories(); // Refresh list
    } catch (error) {
      handleApiError(error, categoryDialog.isEdit ? 'updating category' : 'creating category');
    } finally {
      savingCategory.value = false;
    }
  }
  
  function confirmDeleteCategory(category: Category) {
    $q.dialog({
      title: 'Confirm Delete',
      message: `Delete category "<b>${category.name}</b>"?<br><small>This may fail if it contains list items.</small>`,
      html: true,
      cancel: true, persistent: true, ok: { label: 'Delete', color: 'negative' },
    }).onOk(async () => {
      deletingCategory.value = true; // Optional: Visual cue for delete
      try {
        await CategoryService.deleteCategory(category.id);
        $q.notify({ type: 'positive', message: 'Category deleted.' });
        await fetchCategories(); // Refresh
        // If the deleted category was being viewed, close the view dialog
        if (viewDialog.category?.id === category.id) {
          viewDialog.show = false;
          viewDialog.category = null;
        }
      } catch (error) {
        handleApiError(error, `deleting category ID ${category.id}`);
      } finally {
        deletingCategory.value = false;
      }
    });
  }
  
  // --- List CRUD (within View Dialog) ---
  async function openViewCategoryDialog(category: Category) {
    viewDialog.category = category; // Store the selected category
    viewDialog.show = true;
  
    // Reset list filters and fetch lists for this category when dialog opens
    Object.assign(listFilters, { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc', item: undefined, status: undefined });
    await fetchListsForCategory(category.id); // Initial fetch
  }
  
  function openCreateListDialog(categoryId?: number) {
    if (!categoryId) return;
    listDialog.isEdit = false;
    listDialog.data = { id: undefined, item: '', status: undefined, categoryId: categoryId }; // Reset, set categoryId
    listDialog.originalCategoryId = categoryId;
    listDialog.show = true;
  }
  
  async function loadCategoryOptions() {
    if (categoryOptionsForSelect.value.length > 0) return; // Cache options
    loadingCategoryOptions.value = true;
    try {
      // Fetch all categories (or a subset) for the dropdown
      const response = await CategoryService.getCategories({ limit: 0 }); // limit=0 for all
      categoryOptionsForSelect.value = response.data.map(cat => ({ label: cat.name, value: cat.id }));
    } catch (error) {
      console.error("Failed to load categories for select:", error);
      $q.notify({ type: 'negative', message: 'Could not load categories.' })
    } finally {
      loadingCategoryOptions.value = false;
    }
  }
  
  function openEditListDialog(list: List) {
    listDialog.isEdit = true;
    // Copy data, ensure categoryId is present
    listDialog.data = { ...list, status: list.status ?? undefined, categoryId: list.categoryId };
    listDialog.originalCategoryId = list.categoryId;
    listDialog.show = true;
    loadCategoryOptions(); // Load categories for the dropdown
  }
  
  async function saveList() {
  const isValid = await listFormRef.value?.validate();
  if (!isValid) return;

  savingList.value = true;
  const currentListCategoryId = listDialog.originalCategoryId; // Category context for refresh

  try {
    // Create a clean payload without unnecessary fields
    const payload = { 
      item: listDialog.data.item 
    };
    
    // Only add status if it's defined
    if (listDialog.data.status) {
      payload.status = listDialog.data.status;
    }
    
    if (listDialog.isEdit && listDialog.data.id) {
      // For updates, handle the category relationship properly
      const updatePayload = {
        ...payload,
        // Use connect syntax for relationship updates
        category: listDialog.data.categoryId ? {
          connect: { id: listDialog.data.categoryId }
        } : undefined
      };
      
      await CategoryService.updateList(listDialog.data.id, updatePayload);
      $q.notify({ type: 'positive', message: 'List item updated!' });
    } else if (listDialog.data.categoryId) {
      // For creation, we can use the existing approach
      await CategoryService.createList(listDialog.data.categoryId, payload);
      $q.notify({ type: 'positive', message: 'List item created!' });
    } else {
      throw new Error("Category ID is missing for creating list item.");
    }

    listDialog.show = false;
    await fetchListsForCategory(currentListCategoryId); // Refresh list in the dialog

    // If category was changed, refresh the main category list counts
    if (listDialog.isEdit && listDialog.data.categoryId !== currentListCategoryId) {
      await fetchCategories(); // Refreshes counts
    } else {
      // Refresh category counts in main table if item added/deleted/status changed
      await fetchCategories();
    }

  } catch (error) {
    handleApiError(error, listDialog.isEdit ? 'updating list item' : 'creating list item');
  } finally {
    savingList.value = false;
  }
}
  
  function confirmDeleteList(list: List) {
    $q.dialog({
      title: 'Confirm Delete',
      message: `Delete list item "<b>${list.item}</b>"?`,
      html: true, cancel: true, persistent: true, ok: { label: 'Delete', color: 'negative' },
    }).onOk(async () => {
      deletingList.value = true;
      try {
        await CategoryService.deleteList(list.id);
        $q.notify({ type: 'positive', message: 'List item deleted.' });
        await fetchListsForCategory(list.categoryId); // Refresh the list in the dialog
        await fetchCategories(); // Refresh category counts
      } catch (error) {
        handleApiError(error, `deleting list item ID ${list.id}`);
      } finally {
        deletingList.value = false;
      }
    });
  }
  
  // --- QTable Request Handlers ---
  function handleCategoryRequest(props: Parameters<NonNullable<QTableProps['onRequest']>>[0]) {
    // Update pagination/sort state (computed setter handles this)
    categoryServerPagination.value = props.pagination;
    // Fetch data with new state
    fetchCategories();
  }
  
  function handleListRequest(props: Parameters<NonNullable<QTableProps['onRequest']>>[0]) {
    if (!viewDialog.category?.id) return; // Safety check
    // Update list pagination/sort state
    listServerPagination.value = props.pagination;
    // Fetch list data
    fetchListsForCategory(viewDialog.category.id);
  }
  
  // --- Utility & Helper Functions ---
  function getStatusColor(status?: string | null): string {
    if (status === 'active') return 'positive';
    if (status === 'inactive') return 'grey-7';
    return 'grey-5'; // Default or null
  }
  function getListStatusColor(status?: string | null): string {
    if (status === 'active') return 'positive';
    if (status === 'completed') return 'light-blue';
    if (status === 'inactive') return 'grey-7';
    return 'grey-5';
  }
  
  function handleApiError(error: any, context: string) {
      console.error(`Error ${context}:`, error);
      // Try to get NestJS message, then Axios message, then fallback
      const message = error?.response?.data?.message || error?.message || `Failed to ${context}. Please check logs or try again.`;
      $q.notify({
        type: 'negative',
        message: message,
        timeout: 7000, // Longer timeout for errors
        actions: [{ icon: 'close', color: 'white', round: true, dense: true }]
      });
  }
  
  // --- Watchers ---
  // Optional: Watch filters if you want immediate fetching without debounce (e.g., for selects)
  // watch(() => categoryFilters.status, fetchData);
  
  // --- Lifecycle Hooks ---
  onMounted(() => {
    fetchCategories(); // Fetch initial category data
  });
  
  </script>
  
  <style scoped>
  .sticky-top {
      position: sticky;
      top: 0; /* Adjust if needed based on header */
      background-color: white; /* Or inherit from parent */
      z-index: 10; /* Ensure it's above table content */
  }
  
  /* Ensure dialog content area scrolls, not the whole card */
  .q-dialog .q-card .col {
      overflow: auto;
  }
  
  /* Prevent q-table from expanding card infinitely in flex column */
  .q-table {
      flex-shrink: 0;
  }
  </style>