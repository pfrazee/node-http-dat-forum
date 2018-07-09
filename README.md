# pauls-dat-forum

A Web forum built on Dat and HTTP. This application demonstrates a "hybrid architecture." All user data is written to Dat archives which the user controls on their device. The HTTP server reads the users' Dat archives, then saves the posts into a SQLite database. Visitors to the HTTP server see those saved posts as threads. For visitors to create posts, they need to open the site with [a dat-supporting browser](https://beakerbrowser.com) so that they can create a Dat archive and write the posts.
