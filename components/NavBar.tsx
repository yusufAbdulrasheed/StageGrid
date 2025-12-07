import Link from "next/link"
import Image from "next/image"
const NavBar = () => {
  return (
    <header>
      <nav>
        <Link href="/" className="logo">
            <Image src="/icons/logo.png" alt="Logo" width={32} height={32} />
            <p>Stage Grid</p>
        </Link>

        <ul>
            <Link href="/">Home</Link>
            <Link href="/event">Event</Link>
            <Link href="/create-event">Create Event</Link>
        </ul>
      </nav>
    </header>
  );
};

export default NavBar;
