# pauls-dat-forum

A Web forum built on Dat and HTTP. This application demonstrates a "dat + http hybrid architecture." Involves two roles:

 - **Users**. Must use a browser that supports [Dat](https://datproject.org/). Each user has a "dat archive." They write their posts to `/posts/${site-hostname}/*.json`, and the data is synced to the server.
 - **Server**. An HTTP server. Reads post-files from user dats and stores them in a SQLite DB. Visitors can browse the site to see the content. To participate, they create a Dat archive and submit it to the server.

## Screenshot

![screenshot.png](screenshot.png)

This screenshot is of an instance with 4 users. The 5 visible threads were read from the posts folders of those 4 users' dats.