<template>
  <div class="q-pa-xl">
    <!-- Table with loading state and data display -->
    <q-table
      :rows="items"
      :columns="columns"
      :loading="loading"
      row-key="id"
      flat
      bordered
    >
      <template v-slot:top>
        <div class="row full-width">
          <div class="col-6 q-table__title">{{ props.modelMetadata?.name }}</div>
          <div class="col-6 text-right">
            <q-btn color="primary" icon="add" label="Add New" @click="openCreateDialog" />
          </div>
        </div>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td v-for="col in columns" :key="col.name" :props="props">
            {{ props.row[col.name] }}
          </q-td>
          <q-td auto-width>
            <q-btn flat round color="primary" icon="edit" @click="openEditDialog(props.row)" />
            <q-btn flat round color="negative" icon="delete" @click="confirmDelete(props.row)" />
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Create/Edit Dialog -->
    <q-dialog v-model="dialogVisible" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ isEditing ? 'Edit' : 'Create' }} {{ props.modelMetadata?.name }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-form @submit="handleSubmit" class="q-gutter-md">
            <template v-for="field in props.modelMetadata?.fields" :key="field.name">
                            <!-- Add debugging output -->
                            <!-- <div  class="text-caption">
                              Field: {{ field.name }} -> ({{ field.type }})
                             </div> -->
              <q-input
                v-if="field.type === 'varchar' && !field.isId"
                v-model="formData[field.name]"
                :label="field.name"
                :rules="[
                  val => (field.isRequired ? (val && val.length > 0) || 'This field is required' : true),
                  val => (!field.isUnique || !isDuplicateValue(field.name, val)) || 'This value must be unique'
                ]"
              />
              <q-input
                v-else-if="field.type === 'number' && !field.isId"
                v-model.number="formData[field.name]"
                type="number"
                :label="field.name"
                :rules="[val => (field.isRequired ? val !== null || 'This field is required' : true)]"
              />
              <q-toggle
                v-else-if="field.type === 'boolean' && !field.isId"
                v-model="formData[field.name]"
                :label="field.name"
              />
            </template>

            <div class="row justify-end q-mt-md">
              <q-btn label="Cancel" color="primary" flat v-close-popup />
              <q-btn :label="isEditing ? 'Update' : 'Create'" color="primary" type="submit" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import axios from 'axios'
import { useUtilizatorStore } from '../stores/useUtilizatorStores'

interface ModelField {
  name: string
  type: string
  isRequired: boolean
  isUnique: boolean
  isId: boolean
  default: string | null
  extra: string
}

interface ModelMetadata {
  name: string
  fields: ModelField[]
}

const props = defineProps<{
  modelMetadata: ModelMetadata | null
  baseUrl: string
}>()

const $q = useQuasar()
const items = ref<any[]>([])
const loading = ref(true)
const dialogVisible = ref(false)
const isEditing = ref(false)
const currentItem = ref<any>(null)
const formData = ref<any>({})

// Computed columns based on model metadata
const columns = computed(() => {
  if (!props.modelMetadata) return []
  return [
    ...props.modelMetadata.fields.map(field => ({
      name: field.name,
      label: field.name.charAt(0).toUpperCase() + field.name.slice(1),
      field: field.name,
      sortable: true,
      align: 'left'
    })),
    { name: 'actions', label: 'Actions', field: 'actions', align: 'center' }
  ]
})

// Reset form data when dialog closes
watch(dialogVisible, (newVal) => {
  if (!newVal) {
    console.log('Dialog closed')
    formData.value = {}
    currentItem.value = null
    isEditing.value = false
  }
})

// Load items from API
const loadItems = async () => {
  try {
    loading.value = true
    const response = await axios.get(`${props.baseUrl}`)
    items.value = response.data
  } catch (error: any) {
    $q.notify({
      color: 'negative',
      message: `Error loading data: ${error.message}`,
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Check for duplicate values in unique fields
const isDuplicateValue = (fieldName: string, value: any) => {
  return items.value.some(item => 
    item[fieldName] === value && (!currentItem.value || item.id !== currentItem.value.id)
  )
}

// Dialog handlers
const openCreateDialog = () => {
  // Initialize form data with default values from model metadata
  formData.value = {}
  if (props.modelMetadata?.fields) {
    props.modelMetadata.fields.forEach(field => {
      formData.value[field.name] = field.default ?? null
    })
  }

  isEditing.value = false
  dialogVisible.value = true
}

const openEditDialog = (item: any) => {
  currentItem.value = item
  formData.value = { ...item }
  isEditing.value = true
  dialogVisible.value = true
}

const utilizatorStore = useUtilizatorStore()

// Update the handleSubmit function
const handleSubmit = async () => {
  const cleanedFormData = Object.fromEntries(
    Object.entries(formData.value)
      .filter(([key, value]) => value !== null && key !== 'createdAt')
  );
  
  const config = {
    headers: {
      Authorization: `Bearer ${utilizatorStore.utilizator?.access_token}`
    }
  };
  let date = new Date();

// Add 2 hours (2 hours * 60 minutes * 60 seconds * 1000 milliseconds)
date.setTime(date.getTime() + (2 * 60 * 60 * 1000));
  try {
    if (isEditing.value) {
      await axios.patch(
        `${props.baseUrl}/${currentItem.value.id}`, 
        {...cleanedFormData, updatedAt: date},
        config
      )
    } else {
    //  console.log('Clean Form data:', cleanedFormData)
      await axios.post(props.baseUrl, {...cleanedFormData, updatedAt: date}, config)
    }
    await loadItems()
    dialogVisible.value = false
    $q.notify({
      color: 'positive',
      message: `Item ${isEditing.value ? 'updated' : 'created'} successfully`,
      icon: 'check'
    })
  } catch (error: any) {
    $q.notify({
      color: 'negative',
      message: `Error ${isEditing.value ? 'updating' : 'creating'} item: ${error.message}`,
      icon: 'error'
    })
  }
}

// Update the confirmDelete function
const confirmDelete = (item: any) => {
  $q.dialog({
    title: 'Confirm',
    message: 'Are you sure you want to delete this item?',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await axios.delete(`${props.baseUrl}/${item.id}`, {
        headers: {
          Authorization: `Bearer ${utilizatorStore.utilizator?.access_token}`
        }
      })
      await loadItems()
      $q.notify({
        color: 'positive',
        message: 'Item deleted successfully',
        icon: 'check'
      })
    } catch (error: any) {
      $q.notify({
        color: 'negative',
        message: `Error deleting item: ${error.message}`,
        icon: 'error'
      })
    }
  })
}

// Load items on mount
loadItems()
</script>