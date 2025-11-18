<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Disc from '@/components/Disc.vue'
import useCollectionStore from '@/stores/collection'
import useSessionStore from '@/stores/session'

//
const router = useRouter()
const collectionStore = useCollectionStore();
const session = useSessionStore();

// computed
const sortCollectionBy = computed(() => session.user.preferences.sortCollectionBy);

// sorting separators
const separatorLetter = ref(['a','b','c','d','e']); // TODO
function isFirstOfBlock(name) {
    if (name[0] === separatorLetter.value[0]) {
        separatorLetter.value.shift();
        console.log('taken' + name[0])
        return true
    }
    return false;
}

// methods
function gotoArtistAlbum(album_id) {
    router.push({ name: 'album', params: { albumid: album_id }});
}
</script>

<template>
    <div class="collection">
        <div class="list" v-for="(item,idx) in collectionStore.filteredData">
            <!-- 
            <span v-if="isFirstOfBlock(item.name.toLowerCase())">-----</span>
             -->
            <Disc
                class="shadowed-off clickable"
                :album_id="item.album_id"
                :artist="item.name"
                :title="item.title"
                @click="gotoArtistAlbum(item.album_id)"
            >
            </Disc>
        </div>
    </div>
</template>

<style scoped>
.collection {
    width: 98vw;
    height: 90vh;
    text-align: left;
}
.listOFF {
    display: inline-block;
}
.shadowed {
    border-radius: 10px;
    box-shadow: 3px 3px 1px 0px #8b8b92, 6px 6px 1px 0px #38383b, 9px 9px 1px 0px #000000;
}
</style>
