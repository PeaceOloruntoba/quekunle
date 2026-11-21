import Link from "next/link";
import { ArrowRight, Heart, LockKeyhole, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import ProfilePhoto from "./ProfilePhoto";
import { database } from "@/lib/db";
import Timeline, { type TimelineEntry } from "./Timeline";
import { dateOnly } from "@/lib/date-only";

export default async function Home() {
  const session = await getSession();
  let timeline: TimelineEntry[] = [];
  let names = { queen: "Queen Moyosore", peace: "Peace Adekunle" };
  try {
    const sql = database();
    const [rows, users] = await Promise.all([
      sql`SELECT id, happened_on, title, story FROM timeline_events ORDER BY happened_on, id`,
      sql`SELECT id, display_name FROM users`,
    ]);
    timeline = rows.map((row) => ({
      id: Number(row.id),
      happened_on: dateOnly(row.happened_on),
      title: String(row.title),
      story: String(row.story),
    }));
    names = {
      queen: String(
        users.find((user) => user.id === "queen-moyosore")?.display_name ??
          names.queen,
      ),
      peace: String(
        users.find((user) => user.id === "peace-adekunle")?.display_name ??
          names.peace,
      ),
    };
  } catch (error) {
    console.error(
      "[landing] timeline is not available yet; run npm run db:seed.",
      error,
    );
  }

  return (
    <main className="landing">
      <nav className="nav wrap">
        <Link className="brand" href="/">
          q<span>♥</span>
        </Link>
        <div className="landing-nav-links">
          <a className="nav-link" href="#our-timeline">
            Our timeline
          </a>
          <a className="nav-link" href="#our-story">
            Our little story
          </a>
          <Link className="nav-link" href="/gallery">
            Gallery
          </Link>
          {session && (
            <>
              <Link className="nav-link" href="/memories">
                Memories
              </Link>
              <Link className="nav-link" href="/chat">
                Our chat <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </nav>
      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> JUST US, ALWAYS
          </span>
          <h1>
            A little world
            <br />
            for <em>two.</em>
          </h1>
          <p className="hero-lede">
            A quiet corner of the internet, made for the best conversations with
            my favourite person.
          </p>
          <Link
            className="button button-green"
            href={session ? "/chat" : "/login"}
          >
            {session ? "Open our chat" : "Come on in"} <ArrowRight size={17} />
          </Link>
          <div className="privacy-note">
            <LockKeyhole size={14} /> A private space for {names.queen} &{" "}
            {names.peace}
          </div>
        </div>
        <div className="hero-art" aria-label="An illustrated green garden">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="sparkle s-one">✳</div>
          <div className="sparkle s-two">✦</div>
          <div className="sun" />
          <div className="hill hill-back" />
          <div className="hill hill-front" />
          <div className="flower flower-one">✿</div>
          <div className="flower flower-two">✿</div>
          <div className="center-heart">
            <Heart fill="currentColor" size={28} />
          </div>
          <div className="art-caption">a place that feels like us</div>
        </div>
      </section>
      <Timeline events={timeline} />
      <section className="story wrap" id="our-story">
        <div className="section-head">
          <span className="eyebrow">THE PEOPLE IN THIS LITTLE WORLD</span>
          <h2>Two hearts, one chat.</h2>
          <p>Different shades, same wavelength.</p>
        </div>
        <div className="people-grid">
          <article className="person-card queen">
            <div className="person-top">
              <ProfilePhoto
                src="/api/profiles/queen-moyosore/avatar"
                name={names.queen}
                className="avatar avatar-queen"
                badge="✿"
              />
              <span className="person-symbol">✳</span>
            </div>
            <div className="person-label">THE GREEN HEART</div>
            <h3>{names.queen}</h3>
            <p>
              {names.queen} has a way of making ordinary moments feel special.
              Her warmth, her bright spirit, and her love for green bring a
              little more colour to every conversation. This is her corner of
              our story: full of kindness, laughter, and the little details that
              make her unmistakably her.
            </p>
            <span className="person-tag">
              Queen of my little world <Heart size={13} fill="currentColor" />
            </span>
          </article>
          <article className="person-card peace">
            <div className="person-top">
              <ProfilePhoto
                src="/api/profiles/peace-adekunle/avatar"
                name={names.peace}
                className="avatar avatar-peace"
                badge="✦"
              />
              <span className="person-symbol">◒</span>
            </div>
            <div className="person-label">THE BLUE HEART</div>
            <h3>{names.peace}</h3>
            <p>
              {names.peace} built this little corner with a blue heart and one
              very important person in mind. He loves the easy rhythm of their
              conversations, the stories they trade, and the feeling of having
              someone who makes every day a little better. This is his way of
              making room for all of it.
            </p>
            <span className="person-tag">
              Her favourite person <Heart size={13} fill="currentColor" />
            </span>
          </article>
        </div>
      </section>
      <section className="closing wrap">
        <div>
          <Sparkles size={20} />
          <span>Every good story deserves its own little space.</span>
        </div>
        <Link className="button button-light" href="/login">
          Let’s talk <ArrowRight size={16} />
        </Link>
      </section>
      <footer className="footer wrap">
        <Link className="brand" href="/">
          q<span>♥</span>
        </Link>
        <p>Made for two, with a whole lot of heart.</p>
        <span>
          Built with love by{" "}
          <a
            href="https://peacecodes.pages.dev"
            target="_blank"
            rel="noreferrer"
          >
            peacecodes
          </a>{" "}
          <Heart size={12} fill="currentColor" />
        </span>
      </footer>
    </main>
  );
}
