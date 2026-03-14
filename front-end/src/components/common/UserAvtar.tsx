import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

const UserAvtar = ({ name, image }: { name: string; image?: string }) => {
  return (
    <Avatar>
      {image ? (
        <AvatarImage src={image} alt={name} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
};

export default UserAvtar;
