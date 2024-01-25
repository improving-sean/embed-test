<template>
  <svg
    id="expand-svg"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 60"
    width="60"
    height="60"
  >
    <polygon
      class="cls-1"
      points="51.01 21.01 48.39 23.64 52.88 28.14 7.12 28.14 11.62 23.64 8.99 21.01 0 30 8.99 38.99 11.62 36.36 7.12 31.86 52.88 31.86 48.39 36.36 51.01 38.99 60 30 51.01 21.01"
    />
  </svg>
</template>

<script>
export default {
  name: "ExpandSvg",
};
</script>

<style scoped>
#expand-svg {
  fill: white;
  color: white;
  transform: rotate(45deg);
  transform-origin: center;
}
.cls-1 {
  fill: white;
  padding: 3px;
}
</style>
