export function Navbar() {
    return (
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b1220]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold">Will</div>
  
          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a className="hover:text-slate-100" href="#about">
              About
            </a>
            <a className="hover:text-slate-100" href="#certifications">
              Certifications
            </a>
            <a className="hover:text-slate-100" href="#skills">
              Skills
            </a>
            <a className="hover:text-slate-100" href="#projects">
              Projects
            </a>
            <a className="hover:text-slate-100" href="#experience">
              Experience
            </a>
            <a className="hover:text-slate-100" href="#contact">
              Contact
            </a>
          </nav>
        </div>
      </header>
    );
  }
  