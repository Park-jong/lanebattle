import { defineConfig } from 'vite';

// 포트는 기본값을 쓴다 (5737은 다른 프로젝트가 사용 중)
// 멀티 페이지: index.html(일반) + test.html(빌드 테스트 전용)
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        test: 'test.html',
      },
    },
  },
});
