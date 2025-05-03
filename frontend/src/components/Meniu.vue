<template>
    <div class="q-pa-md" style="max-width: 350px">
      <q-list bordered class="rounded-borders">
        <!-- Administrare Section -->
        <q-expansion-item
          expand-separator
          icon="settings"
          label="Administrare"
          header-class="text-primary"
        >
          <q-card>
            <q-card-section>
              <q-list dense>
                <q-item clickable v-ripple to="/utilizatori">
                  <q-item-section>
                    <q-item-label>Utilizatori</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple>
                  <q-item-section>
                    <q-item-label>Configurare</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </q-expansion-item>
  
        <!-- Casierie Section -->
        <q-expansion-item
          expand-separator
          icon="point_of_sale"
          label="Schema"
          header-class="text-primary"
        >
          <q-card>
            <q-card-section>
              <q-list dense>
                <q-item clickable v-ripple to="/structuri">
                  <q-item-section>
                    <q-item-label>Structuri</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple to="/atributestructuri">
                  <q-item-section>
                    <q-item-label>Atribute structuri</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple to="/persoane">
                  <q-item-section>
                    <q-item-label>Persoane</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple to="/atributepersoane">
                  <q-item-section>
                    <q-item-label>Atribute persoane</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple to="/categories">
                  <q-item-section>
                    <q-item-label>Liste(Categorii)</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple to="/articles">
                  <q-item-section>
                    <q-item-label>Articole</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </q-expansion-item>
  
        <!-- Rapoarte Section -->
        <q-expansion-item
          expand-separator
          icon="assessment"
          label="Rapoarte"
          header-class="text-primary"
        >
          <q-card>
            <q-card-section>
              <q-list dense>
                <q-item clickable v-ripple>
                  <q-item-section>
                    <q-item-label>Registru de casa</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable v-ripple>
                  <q-item-section>
                    <q-item-label>Situatie incasari</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </div>
  </template>
  
  <script setup>
  // No JavaScript logic needed for this basic menu structure
  // You can add reactive variables, methods, etc. here if needed
  </script>
  
  <style scoped>
  /* Add any custom styles here if needed */
  </style>