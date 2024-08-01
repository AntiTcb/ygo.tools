const config = {
    plugins: {
      //Some plugins, like tailwindcss/nesting, need to run before Tailwind,
      'postcss-import': {},
      'tailwindcss/nesting': {},
      tailwindcss: {},
      //But others, like autoprefixer, need to run after,
      autoprefixer: {}
    }
  };

  export default config;
