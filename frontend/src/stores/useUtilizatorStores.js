import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue';
export const useUtilizatorStore = defineStore('utilizatorStore',()=>{
  const text="Pinia..."
  const utilizator=ref(null)
  const institutie=ref(null)
  const eAutentificat=ref(false)
  const eAdmin=ref(false)


 async function autentificare(payload){
      console.log('payload autentificare',payload)
      utilizator.value=payload
      eAutentificat.value=true
    //  eAdmin.value = payload.role==='ADMIN'
   //   if(payload.role=='RESPONSABIL') utilizator.value.compartiment = await $fetch('/api/compartimente/'+payload.id)
  }
  
  function asigneazaInstitutie(payload){
      institutie.value=payload
  }

  function logout(){
     console.log('out')
     eAutentificat.value=false
     utilizator.value=null
     institutie.value=null
     eAdmin.value=false;
  }
  return {
      text,
      utilizator,
      eAdmin,
      eAutentificat,
      institutie,
      autentificare,
      logout,
      asigneazaInstitutie
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUtilizatorStore, import.meta.hot))
}
