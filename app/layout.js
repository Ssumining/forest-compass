import './globals.css';

export const metadata = {
  title: 'NIFOS 산림 지능형 에이전트',
  description: '산림 행정·기술 컨설턴트',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#F4F5F7] font-sans antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
