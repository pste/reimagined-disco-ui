import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const useMenuStore = defineStore('menus', () => {
    const rightMenu = ref(false);
    const infoSnackBar = ref(false);
    const infoSnackBarMsg = ref('');

    function showSnackBar(msg) {
        infoSnackBarMsg.value = msg;
        infoSnackBar.value = true;
    }

    // reset snack on close:
    watch(infoSnackBar, (val) => {
        if (val === false) {
            infoSnackBarMsg = '';
        }
    })

    return {
        rightMenu,
        infoSnackBar,
        infoSnackBarMsg,
        showSnackBar,
    }
})

export default useMenuStore;