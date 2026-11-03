import { Leaf } from "lucide-react";
import { Link } from "react-router-dom";

export default function Brand() {
  return <Link to="/" className="hw-brand" aria-label="HerWell home">
    <span className="hw-brand-mark"><Leaf size={21} strokeWidth={2.2} /><i /></span>
    <span>HerWell</span>
  </Link>;
}
