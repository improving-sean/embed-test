<template>
  <svg
    id="shrink-svg"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 130 70"
    height="130"
    width="70"
  >
    <polygon
      class="cls-1 left-arrow"
      points="50.5 20.51 47.73 23.28 52.48 28.04 0 28.04 0 31.96 52.48 31.96 47.73 36.72 50.5 39.49 60 30 50.5 20.51"
      transform="translate(-5, 0)"
    />
    <polygon
      class="cls-1 right-arrow"
      points="69.5 20.51 72.27 23.28 67.52 28.04 120 28.04 120 31.96 67.52 31.96 72.27 36.72 69.5 39.49 60 30 69.5 20.51"
      transform="translate(5)"
    />
  </svg>
</template>

<script>
export default {
  name: "ShrinkSvg",
};
</script>

<style scoped>
#shrink-svg {
  fill: white;
  transform: rotate(45deg);
  transform-origin: center;
}
.cls-1 {
  fill: white;
  padding: 3px;
}
.left-arrow {
  transform: scale(0, 0) translate(-5, 0);
}
.right-arrow {
  transform: scale(-1, 1) translate(-125, 0);
}
</style>
