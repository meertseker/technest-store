/** Sign in, create account and password pages: one narrow column (forms read best at ~560px) */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="content-container py-10 lg:py-14">{children}</div>
}
