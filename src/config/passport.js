const passport = require("passport");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Only setup Google strategy if credentials exist
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require("passport-google-oauth20").Strategy;
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const avatar = profile.photos[0]?.value;

          let user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            if (!user.googleId) {
              user = await prisma.user.update({
                where: { email },
                data: { googleId: profile.id, avatar },
              });
            }
            return done(null, user);
          }

          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.id,
              avatar,
              name: profile.displayName || null,
              isProfileComplete: false,
            },
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  console.log("✅ Google OAuth initialized");
} else {
  console.warn("⚠️ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;