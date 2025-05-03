<template>
  <div class="q-pa-md">
    <div class="text-h6 q-mb-md">Structuri</div>
    <model-crud-table
      v-if="modelMetadata"
      :model-metadata="modelMetadata"
      :base-url="`${host}/structure`"
    />
    <div v-else-if="error" class="text-negative">
      {{ error }}
    </div>
    <div v-else class="text-center">
      <q-spinner-dots size="40px" color="primary" />
      <div class="q-mt-sm">Loading model metadata...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { host } from '../config/api';
import ModelCrudTable from 'components/ModelCrudTable.vue'
import { useUtilizatorStore } from 'stores/useUtilizatorStores'

const router = useRouter()
const utilizatorStore = useUtilizatorStore()

if (!utilizatorStore.eAutentificat) {
  router.push('/')
}

interface ModelField {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isId: boolean;
  default: string | null;
  extra: string;
}

interface ModelMetadata {
  name: string;
  fields: ModelField[];
}

const modelMetadata = ref<ModelMetadata | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const response = await axios.get(host+'/features/models/Structure')
    modelMetadata.value = response.data
  } catch (err: any) {
    error.value = err.message
    console.error('Error fetching model metadata:', err)
  }
})
</script>


