<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MiniDisc from '@/components/MiniDisc.vue'
import useCollectionStore from '@/stores/collection'
import useSessionStore from '@/stores/session'

//
const router = useRouter();
const collectionStore = useCollectionStore();
const session = useSessionStore();

// computed
const sortCollectionBy = computed(() => session.user.preferences.sortCollectionBy);

// sorting separators
const separatorLetter = initLetters(); // must be NOT reactive (!) - starts from 'b'
function initLetters() {
    const res = [];
    // 98 = 'b'; 122 = 'z'
    for (let i=98; i<=122; i++) {
        res.push(String.fromCharCode(i));
    }
    return res;
}
    
function isFirstOfBlock(name) {
    if (name[0] === separatorLetter[0]) {
        separatorLetter.shift();
        console.log('taken ' + name)
        return true;
    }
    return false;
}

// methods
function gotoArtistAlbum(album_id) {
    router.push({ name: 'album', params: { albumid: album_id }});
}

//const testitems = ref(Array.from({ length: 120 }, (_, i) => i + 1));
</script>

<template>
    <div class="flex flex-wrap gap-3 px-4 py-6">
        <template v-for="(item, index) in collectionStore.filteredData" :key="item.album_id">
            <MiniDisc
                class="clickable"
                :album_id="item.album_id"
                :artist="item.name"
                :title="item.title"
                @click="gotoArtistAlbum(item.album_id)"
            >
            </MiniDisc>
            <div v-if="(index + 1) % 50 === 0" class="w-full"></div>
        </template>
    </div>
</template>

<style scoped>
.collection {
    width: 98vw;
    height: 90vh;
    text-align: left;
}
.list {
    display: inline-block;
}
.list.first-of-block::before {
    content: '\A';
    white-space: pre;
    display: block;
}
.shadowed {
    border-radius: 10px;
    box-shadow: 3px 3px 1px 0px #8b8b92, 6px 6px 1px 0px #38383b, 9px 9px 1px 0px #000000;
}
</style>
