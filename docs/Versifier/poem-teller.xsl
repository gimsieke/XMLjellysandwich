<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:XJS="http://github.com/wendellpiez/XMLjellysandwich"
                xmlns:ixsl="http://saxonica.com/ns/interactiveXSLT"
                version="3.0"
                extension-element-prefixes="ixsl"
    exclude-result-prefixes="#all">


<!--Starter XSLT written courtesy of XML Jelly Sandwich -->


   <!-- We'd do this dynamically if SaxonJS supported accumulators - 
      
      <xsl:include href="accrue-timing.xsl"/>
   
   <xsl:variable name="all-timed">
      <xsl:call-template name="mark-time"/>
   </xsl:variable>-->
   
   <!-- Should bind to catalog document -->
   <!--<xsl:variable name="src-uri" select="document-uri(/)"/>-->


   <xsl:key name="input-by-name" match="input" use="@name"/>
   
   <xsl:key name="button-by-label" match="button" use="string(.)"/>
   
   <xsl:template name="xmljellysandwich_pack">
      <xsl:result-document href="#teller-css">
         <xsl:call-template name="css"/>
      </xsl:result-document>
      <xsl:result-document href="#dir_panel" method="ixsl:replace-content">
         <section class="toc">
            <xsl:apply-templates select="/*/card" mode="toc"/>
         </section>
      </xsl:result-document>
      <!-- XXX applying templates to click one of these links. -->
   </xsl:template>
            
   <xsl:template match="id('dir_select')" mode="ixsl:click">
      <xsl:apply-templates select="id('dir_panel')" mode="switch-in"/>
   </xsl:template>
   
   <xsl:template match="card" mode="toc">
      <h5 class="toc-entry" data-src="{@src}" onclick="void(0)">
         <xsl:apply-templates select="title, (author,date)[1]" mode="toc"/>
      </h5>
   </xsl:template>
   
   <xsl:template match="title" mode="toc">
      <i>
         <xsl:apply-templates/>
      </i>
   </xsl:template>
   
   <xsl:template match="author" mode="toc">
      <xsl:text> (</xsl:text>
      <xsl:apply-templates/>
      <xsl:apply-templates select="../date" mode="toc"/>
      <xsl:text>)</xsl:text>
   </xsl:template>
   
   <xsl:template match="date[empty(../author)]" mode="toc">
      <xsl:text> (</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>)</xsl:text>
   </xsl:template>
   
   <xsl:template match="date" mode="toc">
      <xsl:text>, </xsl:text>
      <xsl:apply-templates/>
   </xsl:template>
   
   <xsl:template match="id('text_select')" mode="ixsl:click">
      <xsl:apply-templates select="id('text_panel')" mode="switch-in"/>
   </xsl:template>
  
   <xsl:template match="id('tell_select')" mode="ixsl:click">
      <xsl:result-document href="#tell_panel" method="ixsl:replace-content">
         <section class="verse">
            <!-- change context to HTML DOM node namely the box where we will find the plain text -->
            <xsl:for-each select="id('poetry-in-motion', ixsl:page())">
               <!-- now we're at the textarea; the text is the DOM's value property. -->
               <!-- we break it out by line groups, producing a stanza for each
                    run of non-ws lines. -->
               <xsl:for-each-group select="tokenize(ixsl:get(., 'value'), '\n')"
                  group-adjacent="matches(., '\S')">
                  <xsl:if test="current-grouping-key()">
                     <div class="stanza">
                        <!-- now for the lines. -->
                        <xsl:for-each select="current-group()">
                           <!-- the indent string is any initial ws per line. -->
                           <xsl:variable name="indent" select="replace(., '\S.*$', '')"/>
                           <!-- remove the tabs to get the spaces. NB tabs are unlikely
                                given most web browsers but this is general. -->
                           <xsl:variable name="spaces"
                              select="string-length(replace($indent, '\t', ''))"/>
                           <!-- the other way to get the spaces. -->
                           <xsl:variable name="tabs"
                              select="string-length(replace($indent, ' ', ''))"/>
                           <!-- The indent will be triple the tabs, plus the spaces.
                              The nominal space width should probably be narrow. -->
                           <p class="line indent{ ($tabs * 3) + $spaces }">
                              <!--<xsl:value-of select="."/>-->
                              <xsl:call-template name="spill-out">
                                 <xsl:with-param name="spilling" select="string(.)"/>
                              </xsl:call-template>
                           </p>
                        </xsl:for-each>
                     </div>
                  </xsl:if>
               </xsl:for-each-group>
            </xsl:for-each>
            <!--<button id="save_me">Save me</button>-->
         </section>
      </xsl:result-document>

      <xsl:apply-templates select="id('dir_panel')"   mode="off"/>
      <xsl:apply-templates select="id('tweak_panel')" mode="off"/>
      <xsl:apply-templates select="id('tell_panel')"  mode="on"/>
      <!-- Start spilling from the first text node, so as to avoid the initial pause.
           Thanks RY for the suggestion! -->
      <xsl:apply-templates select="id('tell_panel')/descendant::text()[1]/.." mode="spill"/>
      
   </xsl:template>
   
   <xsl:template match="id('tweak_select')" mode="ixsl:click">
      <xsl:apply-templates select="id('tweak_panel')" mode="switch-in"/>
   </xsl:template>
   
   <xsl:template match="code[@class='button']" mode="ixsl:click">
      <xsl:apply-templates select="key('button-by-label',string(.))" mode="ixsl:click"/>
   </xsl:template>
   
   <xsl:template match="h5[@class='toc-entry']" mode="ixsl:click">
      <xsl:variable name="poem" select="document(resolve-uri(@data-src))"/>
         <xsl:result-document href="#poetry-in-motion" method="ixsl:replace-content">
           <xsl:apply-templates select="$poem" mode="textonly"/>
      </xsl:result-document>
      <xsl:apply-templates select="id('tweak_panel')" mode="off"/>
      <xsl:apply-templates select="id('text_panel')" mode="on"/>
   </xsl:template>
   
   <xsl:template mode="textonly" match="/*">
      <xsl:apply-templates select="verse" mode="#current"/>
   </xsl:template>
   
   <xsl:template mode="textonly" match="*">
      <xsl:apply-templates select="." mode="vertical-ws"/>
      <xsl:apply-templates mode="#current"/>
   </xsl:template>
   
   
   <xsl:template match="*" mode="vertical-ws">
      <xsl:text>&#10;</xsl:text>
   </xsl:template>
   
   <xsl:template match="l[. is /descendant::l[1]]" mode="vertical-ws"/>
   <xsl:template match="stanza[empty(preceding-sibling::stanza)]" mode="vertical-ws"/>
   <xsl:template match="verse-para[empty(preceding-sibling::verse-para)]" mode="vertical-ws"/>
   <xsl:template match="couplet[empty(preceding-sibling::couplet)]" mode="vertical-ws"/>
   
   <!--<xsl:template mode="textonly" match="*[exists(l)]">
      <xsl:if test="exists(preceding-sibling::*)">  <xsl:text>&#10;</xsl:text></xsl:if>
      <xsl:apply-templates mode="#current"/>
   </xsl:template>-->
   
   <xsl:template mode="textonly" match="l">
      <xsl:apply-templates select="." mode="vertical-ws"/>
      <xsl:apply-templates select="." mode="indent"/>
      <xsl:apply-templates/>
   </xsl:template>
   
   <xsl:template mode="textonly" match="text()[not(matches(.,'\S'))]"/>
   
   <xsl:template mode="textonly" priority="10" match="l//text()">
      <xsl:value-of select="."/>
   </xsl:template>
   
   
   <!--<xsl:template match="l[exists(preceding-sibling::*|../preceding-sibling::*)]">  
      <xsl:text>&#10;</xsl:text>
   </xsl:template>-->
   
   <!-- Specialized line handling for certain poems
        to infer indentation where it might be wanted. -->
   
   <xsl:template match="pub[title='Exequy']//couplet" priority="10" mode="vertical-ws">
      <xsl:if test="count(preceding-sibling::l) mod 2">
         <xsl:text>&#32;&#32;&#32;&#32;&#32;&#32;</xsl:text>
      </xsl:if>
   </xsl:template>
   
   <xsl:template match="*" mode="indent"/>
   
   <xsl:template match="pub[title='Love III']//l" priority="10" mode="indent">
      <xsl:if test="count(preceding-sibling::l) mod 2">
         <xsl:text>&#32;&#32;&#32;&#32;&#32;&#32;</xsl:text>
      </xsl:if>
   </xsl:template>
   
   <xsl:template match="pub[title='As the Starved Maelstrom Laps the Navies']//l" priority="10" mode="indent">
      <xsl:if test="count(preceding-sibling::l) mod 2">
         <xsl:text>&#32;&#32;&#32;&#32;</xsl:text>
      </xsl:if>
   </xsl:template>
   
<!-- Back in unnamed mode ...  -->
<!-- Special handling of inline markup. -->
   
<!-- The Herbert example has special elements 'i' and 'love'  -->
<!-- NB this is not "italic" 'i' !!!  -->
   <!-- btw don't take this as a recommendation of good practice, indexing into uncontrolled values like this... -->
   
   <xsl:template match="pub[title='Love III']//l/i | pub[title='Love III']//l/love">
      <xsl:if test="not(preceding::text()[matches(.,'\S')][1]/name(..) = name())">
         <xsl:text>“</xsl:text>
      </xsl:if>
      <xsl:apply-templates mode="#current"/>
      <xsl:if test="not(following::text()[matches(.,'\S')][1]/name(..) = name())">
        <xsl:text>”</xsl:text>      
      </xsl:if>
   </xsl:template>

   <!-- Back to regular UI programming -->
   
   <!-- matching div.panel elements, turns its display on and its neighbor div.panel elements, off  -->
   <xsl:template mode="switch-in" match="*[contains-token(@class,'ON')]">
            <xsl:apply-templates select="." mode="off"/>
   </xsl:template>
   
   <xsl:template mode="switch-in" match="*">
      <xsl:apply-templates select="." mode="on"/>
   </xsl:template>
   
   
   <xsl:variable name="terminalchars" as="xs:string">\.!\?;,:—…</xsl:variable>
   
   <xsl:template name="spill-out">
      <xsl:param name="spilling" as="xs:string"/>
      
      <xsl:analyze-string select="$spilling" regex="[^{$terminalchars}]*[{$terminalchars}]">
         <xsl:matching-substring>
            <span class="phr hide">
               <xsl:value-of select="."/>
            </span>
         </xsl:matching-substring>
         <xsl:non-matching-substring>
            <span class="phr hide">
               <xsl:value-of select="."/>
            </span>
         </xsl:non-matching-substring>
      </xsl:analyze-string>
   </xsl:template>
   
   
   <xsl:template match="@pause">
      <xsl:attribute name="data-pause" select="."/>
   </xsl:template>
   
   <xsl:template match="*" priority="-0.2" mode="spill">
      <xsl:variable name="pause">
         <xsl:apply-templates select="." mode="pause"/>
      </xsl:variable>
      <!--<xsl:message>pausing <xsl:value-of select="$pause"/> for <xsl:value-of select="name()"/></xsl:message>-->
      <!-- waiting zero just suspends -->
      <xsl:variable name="wait" select="xs:integer($pause * 360) + 1"/>
      <!--<xsl:message>wait is <xsl:value-of select="$wait"/></xsl:message>-->
      <ixsl:schedule-action wait="$wait">
         <xsl:call-template name="show"/>
      </ixsl:schedule-action>
      <!--<xsl:call-template name="show"/>-->
   </xsl:template>
   
   <!-- 'spill' mode performs a sibling traversal in document order -->
   <xsl:template match="node()" mode="spill">
      <xsl:apply-templates select="(child::node() | following::node())[1]" mode="spill"/>
   </xsl:template>
   
   <!-- stop spilling -->
   <xsl:template match="*[not(ancestor-or-self::*[contains-token(@class,'verse')])]" mode="spill"/>
   
   <xsl:template name="show">
      <ixsl:set-attribute name="class"
         select="string-join(tokenize(@class,'\s+')[not(. = 'hide')], ' ')"/>
      <xsl:apply-templates select="(child::node() | following::node())[1]" mode="spill"/>
   </xsl:template>
   <!--<xsl:template name="show"/>-->
   
   <!-- catchall: by default we do not pause for anything -->
   <xsl:template mode="pause" match="node()"     as="xs:integer">
      <xsl:value-of select="(key('input-by-name','fallback',ixsl:page()) ! ixsl:get(., 'value'),0)[1]"/>
   </xsl:template>
   
   <xsl:template mode="pause" match="text()[matches(.,('[' || $terminalchars|| ']$'))]" as="xs:integer">
      <xsl:variable name="char" select="replace(.,('.*([' || $terminalchars|| '])$'),'$1')"/>
      <xsl:value-of select="(key('input-by-name',$char,ixsl:page()) ! ixsl:get(., 'value'),0)[1]"/>
   </xsl:template>
   
   <!-- There are also elements in the tree that give us pause ...  -->
   
   <xsl:template mode="pause" match="*[contains-token(@class,'stanza')]"     as="xs:integer">
      <xsl:value-of select="(key('input-by-name','stanza',ixsl:page()) ! ixsl:get(., 'value'),12)[1]"/>
   </xsl:template>
   
   <xsl:template mode="pause" match="*[contains-token(@class,'line')]"       as="xs:integer">
      <xsl:value-of select="(key('input-by-name','line',ixsl:page()) ! ixsl:get(., 'value'),3)[1]"/>
   </xsl:template>
   
   <xsl:template mode="pause" match="*[@data-pause]" priority="1" as="xs:integer" expand-text="true">
      <xsl:value-of select="xs:integer(@data-pause)"/>
   </xsl:template>
   
   
   <!-- This is the tricky part - -->
   <!-- each phrase looks back at the phrase before, for its pause -->
   <xsl:template mode="pause" xpath-default-namespace="" priority="10"
      match="span[. is root()/descendant::span[contains-token(@class,'phr')][1] ]" 
      as="xs:integer">0</xsl:template>
   
      <xsl:template mode="pause" xpath-default-namespace="" match="span[contains-token(@class,'phr')]" as="xs:integer">
         <!-- Note extra step to text node child: this is what keeps us from recursing to the front. -->
      <xsl:apply-templates select="preceding::span[contains-token(@class,'phr')][1]/text()" mode="pause"/>
   </xsl:template>
   
<xsl:template name="css">
         html, body { background-color: white }
         
         .tag { color: green; font-family: sans-serif; font-size: 80%; font-weight: bold }
         
         
         .pub { }
         
         .title { }
         
         .author { }
         
         .l { padding-left: 2em; text-indent: -2em; margin-top: 0ex; margin-bottom: 0ex }
         
         .l * { display: inline }
         
         span.phr {transition: color 1s ease-in;
              -moz-transition: color 1s ease-in;
              -webkit-transition: color 1s ease-in; }
         
         #xmljellysandwich_footer { clear: both; width: 100%; font-size: 80%;
          border-top: thin solid black; padding-top: 1em; padding-bottom: 2em;
          font-family: 'Roboto Slab', sans-serif;
          margin-top: 1em }
         
                  
        
         textarea { padding: 0.5em }
         button { width: 7em }
         button:hover { font-weight: bold }
         
         section.verse { border: medium solid black; padding: 2ex }
         
         .verse p { padding-left: 3em; text-indent: -3em }
         .stanza p { margin-top: 0ex; margin-bottom: 0ex }
         .stanza { margin-top: 3ex }
         .stanza:first-child { margin-top: 0ex}
         
         .verse .indent1 { padding-left: 3em }
         .verse .indent2 { padding-left: 4em }
         .verse .indent3 { padding-left: 5em }
         .verse .indent4 { padding-left: 6em }
         .verse .indent5 { padding-left: 7em }
         .verse .indent6 { padding-left: 8em }
         .verse .indent7 { padding-left: 9em }
         .verse .indent8 { padding-left: 10em }
         .verse .indent9 { padding-left: 11em }
         
         .panel { display: none; padding: 2%; vertical-align: text-top }
         .panel.ON { display: inline-block } /* way better thanks to AMC */
         
         .hide { display: none }
          
          #tell_panel { background-color: white }
         
         .pane * { margin-top: 1ex; margin-bottom: 1ex }
         
         #right_pane { width: 50%; float: right; clear: both }
         
         #tweak_panel { text-align: right;
         background-color: lavender; padding: 1em; border: thin outset black;
         font-family: sans-serif; font-size: 80%; overflow: auto;
         max-height: 80% }
         #tweak_panel > *:first-child { margin-top: 0ex }
         
         #dir_panel { 
            background-color: lightsteelblue;
            padding: 1em; border: thin outset black;
            font-family: sans-serif }
         #dir_panel > *:first-child { margin-top: 0ex }
         
         .ctrl { display: inline-block; margin: 0ex }
         
         code.button { padding: 0.5ex 1ex; background-color: white; border: thin sold black }
   </xsl:template>
   
   <xsl:template match="*" mode="off">
      <!--<xsl:message>OFF</xsl:message>-->
      <ixsl:set-attribute name="class"
         select="string-join( (tokenize(@class,'\s+')[not(. eq 'ON')]), ' ')"/>
   </xsl:template>
   
   <xsl:template match="*" mode="on">
      <ixsl:set-attribute name="class"
         select="string-join( (tokenize(@class,'\s+')[not(. eq 'ON')],'ON'), ' ')"/>
   </xsl:template>
   
   
</xsl:stylesheet>
