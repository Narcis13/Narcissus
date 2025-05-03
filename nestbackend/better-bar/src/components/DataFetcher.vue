<template>
  <div class="container">
    <h1>{{ title }}</h1>
    
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    
    <div v-if="error" class="error">
      <p>Error: {{ error }}</p>
    </div>
    
    <ul v-if="data && !loading" class="list">
      <li v-for="(item, index) in data" :key="index" class="list-item">
        <p class="value">{{ item.attributeValue || 'Value not available' }}</p>
      </li>
    </ul>
    
    <div v-if="meta && !loading" class="meta">
      <p>Total: {{ meta.total }} | Page: {{ meta.page }} of {{ meta.totalPages }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataFetcher',
  props: {
    url: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: 'Conducere'
    }
  },
  data() {
    return {
      data: null,
      loading: true,
      error: null,
      meta: null
    };
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      try {
        this.loading = true;
        
        const response = await fetch(this.url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const responseJson = await response.json();
        
        // Extract the data array from the response structure
        if (responseJson && responseJson.data && Array.isArray(responseJson.data)) {
          this.data = responseJson.data;
          this.meta = responseJson.meta || null;
        } else {
          throw new Error('Invalid data format: Expected response with data array');
        }
        
        this.error = null;
      } catch (err) {
        console.error('Error fetching data:', err);
        this.error = err instanceof Error ? err.message : 'An unknown error occurred';
        this.data = null;
      } finally {
        this.loading = false;
      }
    }
  },
  watch: {
    url: {
      handler() {
        this.fetchData();
      }
    }
  }
};
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
h1 {
  font-size: 1.875rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  margin-top: 2rem; /* Add more space above the title */
}
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2.5rem 0;
}
.spinner {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 0.25rem solid #f3f3f3;
  border-top: 0.25rem solid #3498db;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.error {
  background-color: #fee2e2;
  border: 1px solid #f87171;
  color: #b91c1c;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
}
.list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
.list-item {
  background-color: white;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0.375rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}
.value {
  font-size: 1rem;
  color: #1f2937;
}
.meta {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
