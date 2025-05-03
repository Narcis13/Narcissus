<template>
    <div class="q-pa-md">
      <h4>{{ modelName }} Management</h4>
      
      <!-- Data Table -->
      <q-table
        :rows="items"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :filter="filter"
        :pagination="pagination"
       
      >
        <template v-slot:top>
          <div class="row full-width">
            <div class="col-6">
              <q-input dense debounce="300" v-model="filter" placeholder="Search">
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-6 flex justify-end">
              <q-btn color="primary" icon="add" label="Add" @click="openDialog()" />
            </div>
          </div>
        </template>
        
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <div class="q-gutter-sm">
              <q-btn size="sm" color="info" icon="edit" dense flat @click="openDialog(props.row)" />
              <q-btn size="sm" color="negative" icon="delete" dense flat @click="confirmDelete(props.row)" />
            </div>
          </q-td>
        </template>
      </q-table>
      
      <!-- Form Dialog -->
      <q-dialog v-model="showDialog" persistent>
        <q-card class="q-pa-md" style="min-width: 500px">
          <q-card-section>
            <div class="text-h6">{{ editingItem.id ? 'Edit' : 'Add' }} {{ modelName }}</div>
          </q-card-section>
  
          <q-card-section>
            <q-form @submit="saveItem" ref="itemForm">
              <div class="row q-col-gutter-md">
                <template v-for="field in formFields" :key="field.name">
                  <!-- Special handling for relation fields -->
                  <div v-if="field.isRelation" class="col-12">
                    <q-select
                      v-model="editingItem[field.name + 'Id']"
                      :label="formatLabel(field.name + 'Id')"
                      :options="relationOptions[field.type] || []"
                      option-value="id"
                      option-label="name"
                      emit-value
                      map-options
                      :rules="[val => field.isRequired ? (val !== null && val !== undefined) || 'This field is required' : true]"
                    />
                  </div>
                  
                  <!-- Enum fields -->
                  <div v-else-if="field.isEnum" class="col-12">
                    <q-select
                      v-model="editingItem[field.name]"
                      :label="formatLabel(field.name)"
                      :options="enumOptions[field.type] || []"
                      :rules="[val => field.isRequired ? !!val || 'This field is required' : true]"
                    />
                  </div>
                  
                  <!-- Boolean fields -->
                  <div v-else-if="field.type === 'Boolean'" class="col-12">
                    <q-toggle
                      v-model="editingItem[field.name]"
                      :label="formatLabel(field.name)"
                    />
                  </div>
                  
                  <!-- Date fields -->
                  <div v-else-if="field.type === 'DateTime'" class="col-12">
                    <q-input
                      v-model="editingItem[field.name]"
                      :label="formatLabel(field.name)"
                      type="datetime-local"
                      :rules="[val => field.isRequired ? !!val || 'This field is required' : true]"
                    />
                  </div>
                  
                  <!-- Number fields -->
                  <div v-else-if="['Int', 'Float'].includes(field.type)" class="col-12">
                    <q-input
                      v-model.number="editingItem[field.name]"
                      :label="formatLabel(field.name)"
                      type="number"
                      :rules="[val => field.isRequired ? (val !== null && val !== undefined) || 'This field is required' : true]"
                    />
                  </div>
                  
                  <!-- Default text fields -->
                  <div v-else class="col-12">
                    <q-input
                      v-model="editingItem[field.name]"
                      :label="formatLabel(field.name)"
                      :rules="[val => field.isRequired ? !!val || 'This field is required' : true]"
                    />
                  </div>
                </template>
              </div>
              
              <div class="row justify-end q-mt-md">
                <q-btn label="Cancel" color="negative" flat v-close-popup />
                <q-btn label="Save" type="submit" color="primary" class="q-ml-sm" />
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </q-dialog>
      
      <!-- Delete Confirmation -->
      <q-dialog v-model="showDeleteConfirm" persistent>
        <q-card>
          <q-card-section class="row items-center">
            <q-avatar icon="delete" color="negative" text-color="white" />
            <span class="q-ml-sm">Are you sure you want to delete this item?</span>
          </q-card-section>
  
          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
            <q-btn flat label="Delete" color="negative" @click="deleteItem" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, reactive } from 'vue';
  import { useQuasar } from 'quasar';
  import { host } from '../config/api';
  import axios from 'axios';
  import { useUtilizatorStore } from '../stores/useUtilizatorStores'
  
  const props = defineProps({
    modelName: {
      type: String,
      required: true
    },
    apiBasePath: {
      type: String,
      required: true
    },
    // Fields that should be excluded from the form (e.g., 'id', 'createdAt', 'updatedAt')
    excludeFields: {
      type: Array,
      default: () => ['id', 'createdAt', 'updatedAt']
    },
    // Optional overrides for field configurations
    fieldOverrides: {
      type: Object,
      default: () => ({})
    },
    // Optional initial field values
    initialValues: {
      type: Object,
      default: () => ({})
    }
  });
  
  const $q = useQuasar();
  const utilizatorStore = useUtilizatorStore()
  // State
  const loading = ref(false);
  const items = ref([]);
  const modelMetadata = ref(null);
  const enumOptions = ref({});
  const relationOptions = ref({});
  const filter = ref('');
  const pagination = ref({
    sortBy: 'id',
    descending: false,
  //  page: 1,
    rowsPerPage: 10,
  //  rowsNumber: 0
  });
  
  const showDialog = ref(false);
  const showDeleteConfirm = ref(false);
  const editingItem = ref({});
  const itemToDelete = ref(null);
  const itemForm = ref(null);
  
  // Computed properties
  const columns = computed(() => {
    if (!modelMetadata.value) return [];
    
    const cols = modelMetadata.value.properties
      .filter(prop => !props.excludeFields.includes(prop.name))
      .map(prop => ({
        name: prop.name,
        label: formatLabel(prop.name),
        field: row => {
          // Handle relation fields
          if (prop.isRelation && row[prop.name]) {
            return row[prop.name].name;
          }
          return row[prop.name];
        },
        sortable: true,
        align: ['Int', 'Float'].includes(prop.type) ? 'right' : 'left'
      }));
    
    // Add actions column
    cols.push({
      name: 'actions',
      label: 'Actions',
      field: 'actions',
      sortable: false,
      align: 'center'
    });
    
    return cols;
  });
  
  const formFields = computed(() => {
    if (!modelMetadata.value) return [];
    
    return modelMetadata.value.properties
      .filter(prop => !props.excludeFields.includes(prop.name))
      .map(prop => {
        // Apply any field overrides
        const override = props.fieldOverrides[prop.name] || {};
        return { ...prop, ...override };
      });
  });

  // Lifecycle hooks
  onMounted(async () => {
    await fetchModelMetadata();
    await fetchEnumOptions();
    await fetchRelationOptions();
    await fetchItems();
    console.log('formFields', formFields.value);
  });
  
  // Methods
  async function fetchModelMetadata() {
    try {
      loading.value = true;
      //host+'/features/models/Structure'
      const response = await axios.get(`${host}/features/prisma/models/${props.modelName}`);
      modelMetadata.value = response.data;
    } catch (error) {
      console.error('Error fetching model metadata:', error);
      $q.notify({
        type: 'negative',
        message: `Failed to fetch ${props.modelName} metadata`
      });
    } finally {
      loading.value = false;
    }
  }
  
  async function fetchEnumOptions() {
    try {
      if (!modelMetadata.value) return;
      
      const enumTypes = modelMetadata.value.properties
        .filter(prop => isEnumType(prop.type))
        .map(prop => prop.type);
      
      if (enumTypes.length === 0) return;
      
      const response = await axios.get(`${host}/features/prisma/modelenums`);
      const enums = response.data;
      
      enumTypes.forEach(enumType => {
        const enumData = enums.find(e => e.name === enumType);
        if (enumData) {
          enumOptions.value[enumType] = enumData.values;
        }
        console.log('enum options', enumOptions.value);
      });
    } catch (error) {
      console.error('Error fetching enum options:', error);
    }
  }
  
  async function fetchRelationOptions() {
    try {
      if (!modelMetadata.value) return;
      
      const relationFields = modelMetadata.value.properties
        .filter(prop => prop.isRelation);
      
      for (const field of relationFields) {
        const modelName = field.type;
       
       const response = await axios.get(`${props.apiBasePath}/${modelName.toLowerCase()}`);
       relationOptions.value[modelName] = response.data;
       
       console.log('relationOptions', relationOptions.value);
      }
    } catch (error) {
      console.error('Error fetching relation options:', error);
    }
  }
  
  async function fetchItems(params = {}) {
    try {
      loading.value = true;
      
      // Merge pagination state with any provided params
      const queryParams = {
        page: pagination.value.page,
        perPage: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        sortDesc: pagination.value.descending,
        filter: filter.value,
        ...params
      };
      
      const response = await axios.get(props.apiBasePath/*, { params: queryParams }*/);
      console.log('response', response.data.data);
      // Handle different API response formats
      if (Array.isArray(response.data.data)) {
        items.value = response.data.data;
        pagination.value.rowsNumber = response.data.length;
      } else if (response.data.data.items && Array.isArray(response.data.data.items)) {
        items.value = response.data.data.items;
        pagination.value.rowsNumber = response.data.data.total || response.data.data.items.length;
      } else {
        items.value = [];
        pagination.value.rowsNumber = 0;
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      $q.notify({
        type: 'negative',
        message: `Failed to fetch ${props.modelName} items`
      });
    } finally {
      loading.value = false;
    }
  }
  
  function openDialog(item = null) {
    if (item) {
      // Edit existing item - make a copy to avoid modifying the original
      editingItem.value = { ...item };
    } else {
      // Create new item
      editingItem.value = { ...props.initialValues };
    }
    
    showDialog.value = true;
  }
  
  async function saveItem() {
    try {
      if (itemForm.value && !await itemForm.value.validate()) {
        return;
      }
      
      loading.value = true;
      const config = {
            headers: {
              Authorization: `Bearer ${utilizatorStore.utilizator?.access_token}`
            }
          };
       let date = new Date();

        // Add 2 hours (2 hours * 60 minutes * 60 seconds * 1000 milliseconds)
        date.setTime(date.getTime() + (2 * 60 * 60 * 1000));
      // Clean the data before sending to backend
      const cleanedData = { ...editingItem.value };
      delete cleanedData.structure;
      delete cleanedData.createdAt;
      delete cleanedData.updatedAt;
      
      if (cleanedData.id) {
        // Update existing item
        await axios.patch(`${props.apiBasePath}/${cleanedData.id}`, {...cleanedData, updatedAt: date},
        config);
        $q.notify({
          type: 'positive',
          message: `${props.modelName} updated successfully`
        });
      } else {
        // Create new item
        await axios.post(props.apiBasePath,  {...cleanedData, updatedAt: date}, config);
        $q.notify({
          type: 'positive',
          message: `${props.modelName} created successfully`
        });
      }
      
      showDialog.value = false;
      await fetchItems();
    } catch (error) {
      console.error('Error saving item:', error);
      $q.notify({
        type: 'negative',
        message: `Failed to save ${props.modelName}: ${error.response?.data?.message || error.message}`
      });
    } finally {
      loading.value = false;
    }
  }
  
  function confirmDelete(item) {
    itemToDelete.value = item;
    showDeleteConfirm.value = true;
  }
  
  async function deleteItem() {
    if (!itemToDelete.value) return;
    
    try {
      loading.value = true;
      await axios.delete(`${props.apiBasePath}/${itemToDelete.value.id}`);
      
      $q.notify({
        type: 'positive',
        message: `${props.modelName} deleted successfully`
      });
      
      await fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      $q.notify({
        type: 'negative',
        message: `Failed to delete ${props.modelName}`
      });
    } finally {
      loading.value = false;
      itemToDelete.value = null;
    }
  }
  
  function onRequest(props) {
    console.log('onRequest', props);
    const { page, rowsPerPage, sortBy, descending } = props.pagination;
    
    pagination.value.page = page;
    pagination.value.rowsPerPage = rowsPerPage;
    pagination.value.sortBy = sortBy;
    pagination.value.descending = descending;
    
    fetchItems();
  }
  
  // Utility functions
  function formatLabel(fieldName) {
    return fieldName
      // Add space before uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Replace underscores with spaces
      .replace(/_/g, ' ')
      // Capitalize first letter
      .replace(/^./, str => str.toUpperCase())
      // Handle special case for 'Id' suffix
      .replace(/\sId$/, ' ID');
  }
  
  function isEnumType(type) {
    if (!modelMetadata.value) return false;
    // Assuming the isEnum method is exposed via the API
    // Alternative: maintain a list of known enum types
    return ['Availibility', 'Datatypes'].includes(type);
  }
  </script>