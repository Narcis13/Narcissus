<template>
    <div class="drawer-tabs q-pb-md">
   <!-- <q-tabs
        v-model="activeTab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <q-tab name="tab1" label="Login" />
        <q-tab name="tab2" label="Profil" />
      </q-tabs> 
  
      <q-separator /> -->
  
      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="tab1">
          <!-- Login Form -->
          <div class="login-form q-pa-md flex flex-center">
            <q-form @submit="onSubmit" class="q-gutter-y-md" style="width: 100%;">
              <q-input
                v-model="username"
                label="Username"
                outlined
                dense
                :rules="[val => !!val || 'Username este obligatoriu']"
              />
              
              <q-input
                v-model="password"
                label="Password"
                outlined
                dense
                type="password"
                :rules="[val => !!val || 'Password este obligatoriu']"
              />
              
              <div class="q-mt-md flex flex-center">
                <q-btn 
                  label="Autentificare" 
                  type="submit" 
                  color="primary"
                  class="q-mt-sm" 
                />
              </div>
            </q-form>
          </div>
        </q-tab-panel>
  
        <q-tab-panel name="tab2">
          <!-- User Info Card -->
          <q-card flat bordered class="q-pa-md">
            <q-card-section>
              <div class="text-h6 q-mb-xs">Informatii Utilizator </div>
              <q-separator />
            </q-card-section>
            
            <q-card-section>
              <div class="q-py-sm">
                <div class="text-subtitle2">Utilizator</div>
                <div>{{utilizatorStore.utilizator.user_profile.username+' '+ utilizatorStore.utilizator.user_profile.email|| 'Neautentificat' }}</div>
              </div>
              
              <div class="q-py-sm">
                <div class="text-subtitle2">Rol</div>
                <div>{{ userInfo.role || 'Administrator' }}</div>
              </div>
              
              <div class="q-py-sm">
                <div class="text-subtitle2">Ultima conectare</div>
                <div>{{ userInfo.lastLogin || '2025-02-26 15:30' }}</div>
              </div>
            </q-card-section>
            
            <q-card-actions align="center">
              <q-btn 
                label="Inchide sesiunea" 
                color="negative" 
                @click="logout" 
              />
            </q-card-actions>
          </q-card>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useQuasar } from 'quasar'
  import { useRouter } from 'vue-router'
  import { useUtilizatorStore } from 'stores/useUtilizatorStores';
  import { host } from '../config/api';
  import axios from 'axios';
  
  const activeTab = ref('tab1');
  const username = ref('');
  const password = ref('');
  const utilizatorStore = useUtilizatorStore();
  const $q = useQuasar();
  const loading = ref(false);
  const router = useRouter()
  // User information state
  const userInfo = ref({
    name: '',
    role: '',
    lastLogin: '',
    first_name: '',
    last_name: '',
    avatar: null
  });
  
  async function onSubmit() {
    try {
      loading.value = true;
      const response = await axios.post(`${host}/auth/login`, {
        username: username.value,
        password: password.value
      });
     // console.log(response);
      // Update user info with response data
      /*userInfo.value = {
        name: `${response.data.first_name} ${response.data.last_name}`,
        role: response.data.role,
        lastLogin: new Date().toLocaleString(),
        avatar: response.data.avatar
      };*/
  
      // Store user data in the utilizator store
      utilizatorStore.autentificare(response.data);
      console.log(utilizatorStore.utilizator.access_token)
      // Show success notification
      $q.notify({
        type: 'positive',
        message: 'Autentificare reușită!',
        position: 'top'
      });
  
      // Switch to profile tab
      activeTab.value = 'tab2';
  
      // Clear form
      username.value = '';
      password.value = '';
    } catch (error) {
      // Handle different error scenarios
      const errorMessage = error.response?.data?.message || 'Eroare la autentificare';
      $q.notify({
        type: 'negative',
        message: errorMessage,
        position: 'top'
      });
    } finally {
      loading.value = false;
    }
  }
  
  function logout() {
    // Clear user info
    userInfo.value = {
      name: '',
      role: '',
      lastLogin: '',
      first_name: '',
      last_name: '',
      avatar: null
    };
  
    // Clear store
    utilizatorStore.logout();
  
    // Show notification
    $q.notify({
      type: 'info',
      message: 'V-ați deconectat cu succes',
      position: 'top'
    });
  
    // Switch to login tab
    activeTab.value = 'tab1';
// Redirect to root page using router
   router.push('/');
  }
  </script>
  
  <style scoped>
  .drawer-tabs {
    width: 100%;
  }
  
  .login-form {
    max-width: 300px;
    margin: 0 auto;
  }
  </style>