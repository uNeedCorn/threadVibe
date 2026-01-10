import { redirect } from "next/navigation";

export default function Home() {
  // 根頁面直接導向登入頁
  // middleware 會處理已登入用戶的導向
  redirect("/login");
}
