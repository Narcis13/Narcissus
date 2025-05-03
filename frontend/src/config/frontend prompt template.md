# Creating a Comprehensive Prompt for Quasar 2 Page Generation
To get the best results when asking an AI model to generate a new Quasar 2 page with Vue 3 and <script setup> for your frontend, you'll need a detailed prompt that provides sufficient context. Here's a comprehensive template you can copy and paste:

```markdown
I'm working on a Quasar 2 frontend project that connects to my NestJS backend. I need to create a new page with the following specifications:

## Project Overview
- Frontend framework: Quasar 2 with Vue 3
- Component style: Using `<script setup>` composition API
- State management: [Specify: Pinia/Vuex/etc.]
- API communication: [Specify: Axios/Fetch/etc.]
- CSS framework: Quasar components with [any custom styling approach]
- Routing: Vue Router as integrated with Quasar

## Page Requirements
- Page name: [Specify name]
- Route path: [Specify route, e.g., /users/profile]
- Purpose: [Describe what the page does]
- Layout: [Specify which layout this page should use]

## Data Requirements
- API endpoints this page will interact with:
  * GET /api/[endpoint] - retrieves [describe data]
  * POST /api/[endpoint] - creates [describe data]
  * [Add other endpoints as needed]
- Data structure example:
```json
{
  "field1": "value1",
  "field2": 123,
  "nestedObject": {
    "subfield": "value"
  }
}
 ```
```

## UI Components Needed
- List of Quasar components to use:
  - q-table for displaying [data type]
  - q-form for [purpose]
  - q-select for [purpose]
  - [Add other components as needed]
## Page Functionality
- User interactions:
  - Ability to [describe action, e.g., filter data]
  - Form submission for [purpose]
  - Navigation to [related pages]
- State management:
  - What data needs to be stored
  - Any shared state requirements
## Existing Code Patterns
Here's an example of a similar page in our project:

```vue
<template>
  <!-- Example template structure -->
</template>

<script setup>
// Example of how we structure our script setup
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useStore } from '[your-store-approach]'
import { apiService } from 'src/services/api.service'

// State declarations
const data = ref([])
const loading = ref(false)
const $q = useQuasar()
const router = useRouter()

// Methods
const fetchData = async () => {
  loading.value = true
  try {
    const response = await apiService.get('/endpoint')
    data.value = response.data
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load data'
    })
  } finally {
    loading.value = false
  }
}

// Lifecycle hooks
onMounted(() => {
  fetchData()
})
</script>
 ```

## Additional Requirements
- Responsive design considerations
- Error handling approach
- Loading states
- Any specific animations or transitions
- Accessibility requirements
Please generate a complete Quasar 2 page using Vue 3 with <script setup> that follows these requirements and matches our existing code patterns.

```plaintext

## Tips for Getting Better Results

1. **Be specific about your data models**: Include actual field names and types that match your backend.

2. **Include real API endpoints**: Provide the actual endpoints this page will interact with.

3. **Show existing patterns**: If possible, include a real example of another page from your project to show your coding style and patterns.

4. **Specify Quasar version**: If you're using a specific version of Quasar, mention it.

5. **Mention any custom plugins or services**: If your project uses custom plugins, services, or utilities, describe how they're typically used.

6. **Describe navigation flow**: Explain how this page fits into the overall navigation of your application.

By providing this level of detail, you'll get much more accurate and useful code from any AI model you choose to use.
 ```
```