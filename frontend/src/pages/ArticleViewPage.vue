<template>
    <q-page padding>
      <q-btn
        flat
        round
        dense
        icon="arrow_back"
        :to="{ name: 'ArticleList' }"
        class="q-mb-md"
        aria-label="Back to list"
      />
  
      <q-spinner v-if="isLoading" size="lg" color="primary" class="q-mt-xl block" />
  
      <q-banner v-else-if="errorLoading" class="bg-negative text-white q-mt-md">
        {{ errorLoading }}
      </q-banner>
  
      <article v-else-if="article">
        <h1 class="text-h3 q-mb-sm">{{ article.title }}</h1>
        <p class="text-subtitle1 text-grey-7 q-mb-lg">Category: {{ article.category }}</p>
  
        <q-btn
            color="primary"
            icon="edit"
            label="Edit Article"
            :to="{ name: 'ArticleEdit', params: { id: article.id } }"
            class="q-mb-lg"
          />
  
        <div class="article-content">
          <div
            v-for="(item, index) in article.content"
            :key="index"
            class="content-item q-mb-md"
          >
            <!-- Paragraph -->
            <div v-if="item.type === 'paragraph'" v-html="item.html"></div>
  
            <!-- File -->
            <div v-else-if="item.type === 'file'">
              <q-icon name="attachment" size="xs" class="q-mr-xs" />
              <a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.name }}</a>
            </div>
  
            <!-- Image -->
            <div v-else-if="item.type === 'image'">
              <img :src="item.src" :alt="item.alt" class="responsive-image q-my-md" />
            </div>
          </div>
        </div>
  
      </article>
  
      <q-banner v-else class="bg-grey-3 q-mt-md">
        Article not found.
      </q-banner>
  
    </q-page>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useQuasar } from 'quasar';
  import { ArticleService } from 'src/services/ArticleService';
  import { Article } from 'src/types/models';
  
  interface Props {
    id: string | number; // Route param comes as string initially
  }
  const props = defineProps<Props>();
  
  const $q = useQuasar();
  const article = ref<Article | null>(null);
  const isLoading = ref(false);
  const errorLoading = ref<string | null>(null);
  
  const fetchArticle = async () => {
    isLoading.value = true;
    errorLoading.value = null;
    const articleId = Number(props.id);
  
    if (isNaN(articleId)) {
      errorLoading.value = 'Invalid article ID.';
      isLoading.value = false;
      return;
    }
  
    try {
      article.value = await ArticleService.getArticleById(articleId);
    } catch (error) {
      console.error(`Failed to fetch article ${articleId}:`, error);
      errorLoading.value = 'Could not load the article. It might not exist or there was a network issue.';
      $q.notify({
        color: 'negative',
        icon: 'error',
        message: errorLoading.value,
      });
    } finally {
      isLoading.value = false;
    }
  };
  
  onMounted(() => {
    fetchArticle();
  });
  </script>
  
  <style scoped>
  .article-content {
    max-width: 800px; /* Adjust as needed */
    margin: 0 auto; /* Center content */
  }
  
  .content-item {
    line-height: 1.6;
  }
  
  /* Style paragraphs rendered via v-html */
  .content-item :deep(p) {
    margin-bottom: 1em;
  }
  .content-item :deep(b),
  .content-item :deep(strong) {
    font-weight: bold;
  }
  /* Add more styles for v-html content as needed */
  
  .responsive-image {
    max-width: 100%;
    height: auto;
    display: block;
    border-radius: 4px; /* Optional: slight rounding */
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); /* Optional: subtle shadow */
  }
  
  .text-h3 {
    margin-top: 0;
  }
  </style>