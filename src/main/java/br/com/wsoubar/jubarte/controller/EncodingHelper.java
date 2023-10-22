package br.com.wsoubar.jubarte.controller;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import org.apache.commons.io.Charsets;

public class EncodingHelper {
    public static void main(String[] args) {
        String olamundo = "Olá ação Cristóvão olá";
        System.out.println(System.getProperty("file.encoding"));
        System.out.println(Charset.defaultCharset());
        System.out.println(olamundo);
        System.out.println(new String(Charsets.ISO_8859_1.encode(olamundo).array(), StandardCharsets.ISO_8859_1));
        System.out.println(new String(StandardCharsets.ISO_8859_1.encode(olamundo).array(), StandardCharsets.ISO_8859_1));
        System.out.println(new String(olamundo.getBytes(), StandardCharsets.UTF_8));
        System.out.println(new String(olamundo.getBytes(), StandardCharsets.ISO_8859_1));
        //System.out.println("XPTO");
    }
}
