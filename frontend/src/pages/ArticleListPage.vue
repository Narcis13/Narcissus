<template>
    <q-page padding>
      <q-tabs
        v-model="activeTab"
        class="text-primary q-mb-md"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="design" label="Design" />
        <q-tab name="preview" label="Preview" />
      </q-tabs>

      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="design">
          <div class="row justify-between items-center q-mb-md">
            <div class="text-h4">Articles</div>
            <q-btn
              color="primary"
              icon="add"
              label="Create Article"
              :to="{ name: 'ArticleCreate' }"
            />
          </div>
      
          <q-spinner v-if="isLoading" size="lg" color="primary" class="q-mt-xl" />
      
          <q-table
            v-else-if="articles.length > 0"
            :rows="articles"
            :columns="columns"
            row-key="id"
            flat
            bordered
            class="q-mt-md"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  flat
                  dense
                  round
                  icon="visibility"
                  color="info"
                  :to="{ name: 'ArticleView', params: { id: props.row.id } }"
                  class="q-mr-sm"
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  :to="{ name: 'ArticleEdit', params: { id: props.row.id } }"
                  class="q-mr-sm"
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  @click="confirmDeleteArticle(props.row.id, props.row.title)"
                />
              </q-td>
            </template>
          </q-table>
      
          <q-banner v-else class="bg-grey-3 q-mt-md">
            No articles found. Create one to get started!
          </q-banner>
        </q-tab-panel>

        <q-tab-panel name="preview">
          <div class="text-h4 q-mb-md">Preview</div>
          <BlogView :api-url="`${host}/articles`" />
        </q-tab-panel>
      </q-tab-panels>
    </q-page>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { useQuasar, QTableColumn } from 'quasar';
  import { ArticleService } from 'src/services/ArticleService';
  import { Article } from '../types/models';
  import BlogView from '../components/BlogView.vue';
  import { host } from '../config/api';
  
  const $q = useQuasar();
  const router = useRouter(); // Use router if needed, though <router-link>/:to is often simpler
  
  const activeTab = ref('design'); // Default active tab
  const articles = ref<Article[]>([]);
  const isLoading = ref(false);
  
  const columns: QTableColumn[] = [
    { name: 'title', label: 'Title', field: 'title', align: 'left', sortable: true },
    { name: 'category', label: 'Category', field: 'category', align: 'left', sortable: true },
    { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
  ];
  
  const fetchArticles = async () => {
    isLoading.value = true;
    try {
      articles.value = await ArticleService.getArticles();
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      $q.notify({
        color: 'negative',
        icon: 'error',
        message: 'Could not load articles. Please try again later.',
      });
    } finally {
      isLoading.value = false;
    }
  };
  
  const confirmDeleteArticle = (id: number, title: string) => {
    $q.dialog({
      title: 'Confirm Delete',
      message: `Are you sure you want to delete the article "${title}"? This action cannot be undone.`,
      cancel: true,
      persistent: true,
      ok: {
        label: 'Delete',
        color: 'negative',
      },
    }).onOk(async () => {
      await deleteArticle(id);
    });
  };
  
  const deleteArticle = async (id: number) => {
    console.log(`Deleting article ${id}`); // Add this line to check if the function is being called
  //  $q.loading.show({ message: 'Deleting article...' });
    try {
      await ArticleService.deleteArticle(id);
      $q.notify({
        color: 'positive',
        icon: 'check_circle',
        message: 'Article deleted successfully.',
      });
      // Refresh the list
      await fetchArticles();
    } catch (error) {
      console.error(`Failed to delete article ${id}:`, error);
      $q.notify({
        color: 'negative',
        icon: 'error',
        message: 'Failed to delete article. Please try again.',
      });
    } finally {
     //$q.loading.hide();
    }
  };
  
  onMounted(() => {
    fetchArticles();
  });
  </script>
  
  <style scoped>
  .text-h4 {
    margin: 0;
  }
  </style>