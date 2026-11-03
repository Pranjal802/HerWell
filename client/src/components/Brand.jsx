import { Flower2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Brand() {
  return <Link to="/" className="flex items-center gap-2.5 font-[Manrope] text-xl font-extrabold tracking-tight text-[#234636]">
    <span className="grid size-9 place-items-center rounded-xl bg-[#edf3ea] text-[#2f5b48]"><Flower2 size={21} /></span>
    <span>her<span className="font-medium text-[#738378]">well</span></span>
  </Link>;
}
