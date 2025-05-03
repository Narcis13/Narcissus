<template>
    <q-page padding>
      <dynamic-crud
        modelName="PersonAttributes"
        :apiBasePath="apiBasePath"
        :excludeFields="['id', 'personId','createdAt', 'updatedAt']"
        :fieldOverrides="fieldOverrides"
        :initialValues="initialValues"
      />
    </q-page>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { host } from '../config/api';

  import { useUtilizatorStore } from 'stores/useUtilizatorStores'
  import { useRouter } from 'vue-router'
  import DynamicCrud from 'components/DynamicCrud.vue';
  

  const router = useRouter()
const utilizatorStore = useUtilizatorStore()

if (!utilizatorStore.eAutentificat) {
  router.push('/')
}

  const fieldOverrides = {
    // Override field configurations if needed
    attributeValue: {
      type: 'String',
      isRequired: true,
      // Additional validations or configurations
    }
  };
  
  const initialValues = ref({
    status: 'active',
    datatype: 'TEXT'
  });
  
  const apiBasePath = host + '/person-attributes';
  // You can also fetch any additional data needed for this specific model
  onMounted(async () => {
    try {
      // Example: fetch any additional data needed for this model
      // const response = await axios.get('/api/some-endpoint');
      // Do something with the response
    } catch (error) {
      console.error('Error fetching additional data:', error);
    }
  });
  </script>